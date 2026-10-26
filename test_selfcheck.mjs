import { Capri } from './capri-opencode.js';

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

const hooks = await Capri({ directory: 'C:/work/app' });
const send = (event) => hooks.event({ event });

await send({ type: 'session.created', properties: { info: { id: 's1', directory: 'C:/work/app', title: 'T' } } });
await hooks['chat.message']({ sessionID: 's1' }, { message: { id: 'u1' }, parts: [{ type: 'text', text: 'fix the bug' }] });
await send({ type: 'message.updated', properties: { info: { id: 'a1', sessionID: 's1', role: 'assistant' } } });
await send({ type: 'message.part.updated', properties: { part: { id: 'p1', sessionID: 's1', messageID: 'a1', type: 'text', text: 'Done.' } } });
await hooks['tool.execute.before']({ tool: 'edit', sessionID: 's1', callID: 'c1' }, { args: { filePath: 'src/a.js', oldString: 'x' } });
await send({ type: 'permission.updated', properties: { sessionID: 's1', title: 'Run npm test' } });
await send({ type: 'message.part.updated', properties: { part: { id: 'p2', sessionID: 's1', messageID: 'a1', type: 'tool', tool: 'bash', callID: 'c2', state: { status: 'error', input: { command: 'npm test' }, error: 'Exit code 1' } } } });
await send({ type: 'session.idle', properties: { sessionID: 's1' } });

assert(by('SessionStart')[0].cwd === 'C:/work/app', 'SessionStart cwd');
assert(by('UserPromptSubmit')[0].prompt === 'fix the bug', 'prompt');
assert(by('PreToolUse')[0].tool_name === 'Edit', 'tool name mapping');
assert(by('PreToolUse')[0].tool_input.file_path === 'src/a.js', 'args mapping');
assert(by('Notification')[0].notification_type === 'permission_prompt', 'permission');
assert(by('PostToolUseFailure')[0].tool_name === 'Bash', 'failure tool mapping');
assert(by('PostToolUseFailure')[0].error === 'Exit code 1', 'failure error');
assert(by('Stop')[0].last_assistant_message === 'Done.', 'last answer');

await send({ type: 'message.part.updated', properties: { part: { id: 'p2', sessionID: 's1', messageID: 'a1', type: 'tool', tool: 'bash', callID: 'c2', state: { status: 'error', input: {}, error: 'Exit code 1' } } } });
assert(by('PostToolUseFailure').length === 1, 'failure is sent once per callID');

await send({ type: 'session.error', properties: { sessionID: 's1', error: { name: 'MessageAbortedError', data: { message: 'aborted' } } } });
assert(by('StopFailure').length === 0, 'Esc is not a crash');

// subagent session: no hello, no tool count, no early victory
const before = calls.length;
await send({ type: 'session.created', properties: { info: { id: 'child', directory: 'C:/work/app', title: 'task', parentID: 's1' } } });
await hooks['tool.execute.before']({ tool: 'bash', sessionID: 'child', callID: 'c9' }, { args: { command: 'ls' } });
await send({ type: 'session.idle', properties: { sessionID: 'child' } });
await send({ type: 'session.deleted', properties: { info: { id: 'child', directory: 'C:/work/app' } } });
assert(calls.length === before, 'child session is ignored');

console.log('ok -', calls.length, 'events ->', calls[0].url);
