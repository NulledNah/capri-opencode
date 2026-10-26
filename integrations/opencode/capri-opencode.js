/*
 * Capri bridge for opencode.
 *
 * Translates opencode plugin events into the Claude Code hook events Capri
 * (github.com/mochiiwuff/capri-desktop) already understands, and POSTs them to
 * its local bridge: http://127.0.0.1:47823/event
 *
 * No patch, no fork. Capri must be running; when it is not, the POST fails
 * silently and opencode is unaffected.
 *
 * Install: copy this file to ~/.config/opencode/plugins/ (or run installa.bat).
 * Port override: CAPRI_PORT
 */

const PORT = Number(process.env.CAPRI_PORT) || 47823;

// opencode tool name -> the Claude Code tool name Capri's labels know.
const TOOLS = {
  read: 'Read', write: 'Write', edit: 'Edit', multiedit: 'MultiEdit',
  notebookedit: 'NotebookEdit', bash: 'Bash', shell: 'Bash',
  powershell: 'PowerShell', grep: 'Grep', glob: 'Glob', webfetch: 'WebFetch',
  websearch: 'WebSearch', task: 'Task', agent: 'Agent', skill: 'Skill',
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

export const Capri = async ({ directory }) => {
  const parts = new Map();          // messageID -> Map(partID -> text)
  const lastAssistant = new Map();  // sessionID -> messageID
  const lastUser = new Map();       // sessionID -> messageID
  const failed = new Set();         // tool callIDs whose failure was sent
  const children = new Set();       // subagent sessions: the parent's task tool already covers them
  const isChild = (sessionID) => children.has(sessionID);

  const answer = (messageID) => {
    const texts = parts.get(messageID);
    return texts ? [...texts.values()].join('\n\n').trim() : '';
  };

  return {
    "chat.message": async (info, out) => {
      if (isChild(info.sessionID)) return;
      try {
        lastUser.set(info.sessionID, out.message.id);
        const prompt = out.parts
          .filter((p) => p.type === 'text' && !p.synthetic && !p.ignored)
          .map((p) => p.text)
          .join('\n')
          .trim();
        emit({ hook_event_name: 'UserPromptSubmit', session_id: info.sessionID, cwd: directory, prompt });
      } catch { /* never break opencode */ }
    },

    "tool.execute.before": async (info, out) => {
      if (isChild(info.sessionID)) return;
      try {
        emit({
          hook_event_name: 'PreToolUse',
          session_id: info.sessionID,
          cwd: directory,
          tool_name: TOOLS[info.tool] || info.tool,
          tool_input: toolInput(out.args),
          tool_use_id: info.callID,
        });
      } catch { /* never break opencode */ }
    },

    event: async ({ event }) => {
      try {
        const p = event.properties || {};
        switch (event.type) {
          case 'session.created': {
            const info = p.info;
            if (info.parentID) {
              children.add(info.id); // subagent session: its tools would double-count and its idle would celebrate early
              return;
            }
            return emit({
              hook_event_name: 'SessionStart',
              session_id: info.id,
              cwd: info.directory || directory,
              session_title: info.title,
              source: 'startup',
            });
          }

          case 'message.updated': {
            const info = p.info;
            if (info?.role === 'assistant' && !isChild(info.sessionID)) {
              const prev = lastAssistant.get(info.sessionID);
              if (prev && prev !== info.id) parts.delete(prev); // keep only the last answer
              lastAssistant.set(info.sessionID, info.id);
            }
            return;
          }

          case 'message.part.updated': {
            const part = p.part;
            if (!part || !part.sessionID || isChild(part.sessionID)) return;
            if (part.type === 'text' && part.messageID !== lastUser.get(part.sessionID)) {
              const texts = parts.get(part.messageID) || new Map();
              texts.set(part.id, part.text);
              parts.set(part.messageID, texts);
            }
            if (part.type === 'tool' && part.state?.status === 'error' && !failed.has(part.callID)) {
              failed.add(part.callID);
              emit({
                hook_event_name: 'PostToolUseFailure',
                session_id: part.sessionID,
                cwd: directory,
                tool_name: TOOLS[part.tool] || part.tool,
                tool_input: toolInput(part.state.input),
                tool_use_id: part.callID,
                error: part.state.error,
              });
            }
            return;
          }

          case 'permission.updated': // SDK name
          case 'permission.asked':   // newer alias
            return emit({
              hook_event_name: 'Notification',
              session_id: p.sessionID,
              cwd: directory,
              notification_type: 'permission_prompt',
              message: p.title || p.permission || p.type,
            });

          case 'session.idle':
            if (isChild(p.sessionID)) return;
            return emit({
              hook_event_name: 'Stop',
              session_id: p.sessionID,
              cwd: directory,
              last_assistant_message: answer(lastAssistant.get(p.sessionID)),
            });

          case 'session.error':
            if (isChild(p.sessionID)) return;
            if (!p.error || p.error.name === 'MessageAbortedError') return; // you pressed Esc
            return emit({
              hook_event_name: 'StopFailure',
              session_id: p.sessionID,
              cwd: directory,
              error: p.error.data?.message || p.error.name,
            });

          case 'session.compacted':
            if (isChild(p.sessionID)) return;
            return emit({ hook_event_name: 'PreCompact', session_id: p.sessionID, cwd: directory });

          case 'session.deleted': {
            const id = p.info.id;
            const wasChild = children.delete(id);
            lastAssistant.delete(id);
            lastUser.delete(id);
            if (wasChild) return;
            return emit({
              hook_event_name: 'SessionEnd',
              session_id: id,
              cwd: p.info.directory || directory,
            });
          }
        }
      } catch { /* never break opencode */ }
    },
  };
};
