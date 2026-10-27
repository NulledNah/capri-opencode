import Capri from './capri-opencode.js';

const calls = [];
globalThis.fetch = (url, opts) => {
  calls.push({ url, body: JSON.parse(opts.body) });
  return Promise.resolve({ ok: true });
};

const assert = (cond, msg) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
};
const by = (name) => calls.filter((c) => c.body.hook_event_name === name).map((c) => c.body);

// A fake opencode: one plugin instance per open location, each with its own event stream.
function makeInstance(directory) {
  const hooks = {};
  const queue = [];
  let wake = null;
  async function* stream() {
    for (;;) {
      if (!queue.length) await new Promise((r) => (wake = r));
      const next = queue.shift();
      if (next === null) return;
      yield next;
    }
  }
  const ctx = {
    location: { directory },
    session: { hook: async (name, fn) => { hooks[`session.${name}`] = fn; } },
    tool: { hook: async (name, fn) => { hooks[`tool.${name}`] = fn; } },
    event: { subscribe: () => stream() },
  };
  let seq = 0;
  const send = async (type, data, id = `evt_${++seq}`) => {
    queue.push({ id, type, data });
    if (wake) { const r = wake; wake = null; r(); }
    await new Promise((r) => setTimeout(r, 0));
    return id;
  };
  return { ctx, hooks, send };
}

delete globalThis.__capriOpencode;
const first = makeInstance('C:/work/app');
const second = makeInstance('C:/other/project'); // same process, second open location
await Capri.setup(first.ctx);
await Capri.setup(second.ctx);

const send = first.send;
const hooks = first.hooks;

await send('session.created', {
  sessionID: 's1',
  title: 'T',
  location: { directory: 'C:/work/app' },
});

hooks['session.prompt']({ sessionID: 's1', messageID: 'u1', prompt: { text: 'fix the bug' } });
hooks['tool.execute.before']({ tool: 'edit', sessionID: 's1', agent: 'build', messageID: 'a1', id: 'c1', input: { filePath: 'src/a.js' } });
await send('permission.asked', { id: 'per1', sessionID: 's1', action: 'shell', resources: ['npm test'] });
hooks['tool.execute.before']({ tool: 'bash', sessionID: 's1', agent: 'build', messageID: 'a1', id: 'c2', input: { command: 'npm test' } });
await send('session.tool.failed', {
  sessionID: 's1',
  assistantMessageID: 'a1',
  id: 'c2',
  error: { type: 'tool.execution', message: 'File not found: src/a.js' },
});
await send('session.text.ended', { sessionID: 's1', assistantMessageID: 'a1', ordinal: 0, text: 'Fixed it.' });
await send('session.text.ended', { sessionID: 's1', assistantMessageID: 'a1', ordinal: 1, text: 'Tests pass.' });
await send('session.execution.succeeded', { sessionID: 's1' });

assert(by('SessionStart')[0].cwd === 'C:/work/app', 'SessionStart cwd');
assert(by('SessionStart')[0].session_title === 'T', 'SessionStart title');
assert(by('UserPromptSubmit')[0].prompt === 'fix the bug', 'prompt');
assert(by('PreToolUse')[0].tool_name === 'Edit', 'tool name mapping');
assert(by('PreToolUse')[0].tool_input.file_path === 'src/a.js', 'args mapping');
assert(by('Notification')[0].notification_type === 'permission_prompt', 'permission');
assert(by('Notification')[0].message === 'shell npm test', 'permission message');
assert(by('PostToolUseFailure')[0].tool_name === 'Bash', 'failure tool mapping');
assert(by('PostToolUseFailure')[0].error === 'File not found: src/a.js', 'failure error');
assert(by('Stop')[0].last_assistant_message === 'Fixed it.\n\nTests pass.', 'last answer');

// every open location receives every event: it must still reach her once
const again = await send('session.execution.succeeded', { sessionID: 's1' }, 'evt_dup');
await second.send('session.execution.succeeded', { sessionID: 's1' }, 'evt_dup');
assert(by('Stop').length === 2, 'same event from another instance is ignored');
assert(again === 'evt_dup', 'helper returns the id');

// Esc is not a crash
await send('session.execution.interrupted', { sessionID: 's1' });
assert(by('StopFailure').length === 0, 'Esc is not a crash');

// a failed run is
await send('session.execution.failed', { sessionID: 's1', error: { message: 'provider down' } });
assert(by('StopFailure')[0].error === 'provider down', 'run failure');

// subagent session: no hello, no early victory, no goodbye
const before = calls.length;
await send('session.created', { sessionID: 'child', title: 'task', parentID: 's1', location: { directory: 'C:/work/app' } });
await send('session.execution.succeeded', { sessionID: 'child' });
await send('session.deleted', { sessionID: 'child' });
assert(calls.length === before, 'child session is ignored');

await send('session.compaction.started', { sessionID: 's1' });
await send('session.deleted', { sessionID: 's1' });
assert(by('PreCompact').length === 1, 'compaction');
assert(by('SessionEnd')[0].session_id === 'opencode:s1', 'session end');

console.log('ok -', calls.length, 'events ->', calls[0].url);
