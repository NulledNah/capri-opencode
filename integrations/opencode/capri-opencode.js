/*
 * Capri bridge for OpenCode 2.
 *
 * Translates OpenCode's plugin events and hooks into the Claude Code hook events
 * Capri (github.com/mochiiwuff/capri-desktop) already understands, and POSTs them
 * to her local bridge: http://127.0.0.1:47823/event
 *
 * No patch, no fork. Capri must be running; when it is not, the POST fails
 * silently and opencode is unaffected.
 *
 * Install: copy this file to ~/.config/opencode/plugins/ (or run install.bat).
 * Port override: CAPRI_PORT
 */

const PORT = Number(process.env.CAPRI_PORT) || 47823;

// opencode tool name -> the Claude Code tool name Capri's labels know.
const TOOLS = {
  read: 'Read', write: 'Write', edit: 'Edit', multiedit: 'MultiEdit',
  notebookedit: 'NotebookEdit', bash: 'Bash', shell: 'Bash',
  powershell: 'PowerShell', grep: 'Grep', glob: 'Glob', webfetch: 'WebFetch',
  websearch: 'WebSearch', task: 'Task', subagent: 'Task', agent: 'Agent', skill: 'Skill',
};

// opencode camelCase args -> the snake_case keys Capri reads.
function toolInput(args) {
  const a = args || {};
  const out = {
    file_path: a.filePath ?? a.file_path ?? a.path,
    notebook_path: a.notebookPath ?? a.notebook_path,
    description: a.description,
    command: a.command,
    pattern: a.pattern,
    url: a.url,
    query: a.query,
    skill: a.skill,
    subagent_type: a.subagent_type,
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

function emit(event) {
  fetch(`http://127.0.0.1:${PORT}/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(500),
  }).catch(() => {});
}

// opencode loads the plugin once per open location, in the same server process, and
// every instance receives every event. Shared state + event ids make each event count once.
function state() {
  return (globalThis.__capriOpencode ||= {
    seen: new Set(),
    dirs: new Map(),     // sessionID -> cwd
    children: new Set(), // subagent sessions
    calls: new Map(),    // callID -> { tool, input }
    texts: new Map(),    // sessionID -> { messageID, parts: Map }
  });
}

const MAX_CALLS = 512;

export default {
  id: 'capri',
  async setup(ctx) {
    const s = state();
    const home = ctx.location?.directory || process.cwd();

    // every event arrives once per loaded location: the first instance to see an id keeps it
    const once = (id) => {
      if (!id || s.seen.has(id)) return false;
      s.seen.add(id);
      if (s.seen.size > 1024) s.seen.delete(s.seen.values().next().value);
      return true;
    };
    const cwdOf = (sessionID) => s.dirs.get(sessionID) || home;
    const isChild = (sessionID) => s.children.has(sessionID);
    const answer = (sessionID) => {
      const t = s.texts.get(sessionID);
      return t ? [...t.parts.values()].join('\n\n').trim() : '';
    };

    await ctx.session.hook('prompt', (event) => {
      try {
        emit({
          hook_event_name: 'UserPromptSubmit',
          session_id: event.sessionID,
          cwd: cwdOf(event.sessionID),
          prompt: String(event.prompt?.text || '').trim(),
        });
      } catch { /* never break opencode */ }
    });

    await ctx.tool.hook('execute.before', (event) => {
      try {
        s.calls.set(event.id, { tool: event.tool, input: event.input });
        if (s.calls.size > MAX_CALLS) s.calls.delete(s.calls.keys().next().value);
        emit({
          hook_event_name: 'PreToolUse',
          session_id: event.sessionID,
          cwd: cwdOf(event.sessionID),
          tool_name: TOOLS[event.tool] || event.tool,
          tool_input: toolInput(event.input),
          tool_use_id: event.id,
        });
      } catch { /* never break opencode */ }
    });

    function handle(event) {
      const p = event.data || {};
      switch (event.type) {
        case 'session.created': {
          if (!once(event.id)) return;
          const id = p.sessionID;
          s.dirs.set(id, p.location?.directory || home);
          if (p.parentID) {
            s.children.add(id); // subagent session: its tools would double-count and it would celebrate early
            return;
          }
          return emit({
            hook_event_name: 'SessionStart',
            session_id: id,
            cwd: cwdOf(id),
            session_title: p.title,
            source: 'startup',
          });
        }

        case 'session.text.ended': {
          if (!once(event.id) || isChild(p.sessionID)) return;
          const cur = s.texts.get(p.sessionID);
          if (cur && cur.messageID === p.assistantMessageID) cur.parts.set(p.ordinal, p.text);
          else s.texts.set(p.sessionID, { messageID: p.assistantMessageID, parts: new Map([[p.ordinal, p.text]]) });
          return;
        }

        case 'session.tool.failed': {
          if (!once(event.id) || isChild(p.sessionID)) return;
          const call = s.calls.get(p.id) || {};
          return emit({
            hook_event_name: 'PostToolUseFailure',
            session_id: p.sessionID,
            cwd: cwdOf(p.sessionID),
            tool_name: TOOLS[call.tool] || call.tool,
            tool_input: toolInput(call.input),
            tool_use_id: p.id,
            error: p.error?.message || p.error?.type,
          });
        }

        case 'permission.asked': {
          if (!once(event.id)) return;
          const what = [p.action, ...(p.resources || [])].filter(Boolean).join(' ');
          return emit({
            hook_event_name: 'Notification',
            session_id: p.sessionID,
            cwd: cwdOf(p.sessionID),
            notification_type: 'permission_prompt',
            message: what,
          });
        }

        case 'session.execution.succeeded': {
          if (!once(event.id) || isChild(p.sessionID)) return;
          return emit({
            hook_event_name: 'Stop',
            session_id: p.sessionID,
            cwd: cwdOf(p.sessionID),
            last_assistant_message: answer(p.sessionID),
          });
        }

        case 'session.execution.failed': {
          if (!once(event.id) || isChild(p.sessionID)) return;
          return emit({
            hook_event_name: 'StopFailure',
            session_id: p.sessionID,
            cwd: cwdOf(p.sessionID),
            error: p.error?.message || p.error?.type || p.message,
          });
        }

        // Esc: you stopped it, it didn't crash.
        case 'session.execution.interrupted':
          return;

        case 'session.compaction.started': {
          if (!once(event.id) || isChild(p.sessionID)) return;
          return emit({ hook_event_name: 'PreCompact', session_id: p.sessionID, cwd: cwdOf(p.sessionID) });
        }

        case 'session.deleted': {
          if (!once(event.id)) return;
          const id = p.sessionID;
          const wasChild = s.children.delete(id);
          s.texts.delete(id);
          const cwd = cwdOf(id);
          s.dirs.delete(id);
          if (wasChild) return;
          return emit({ hook_event_name: 'SessionEnd', session_id: id, cwd });
        }
      }
    }

    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          try { handle(event); } catch { /* never break opencode */ }
        }
      } catch { /* aborted on unload */ }
    })();

    return () => controller.abort();
  },
};
