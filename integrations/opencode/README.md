# Capri plugin for OpenCode

The adapter that lets [Capri](../..) watch **OpenCode**. It translates OpenCode
plugin events into the hook events Capri already understands and POSTs them to
her local bridge (`127.0.0.1:47823`). No patch, no fork of OpenCode.

## Install

The app does it for you: right-click Capri and click **Install OpenCode plugin**
(or use her welcome panel). It copies this file to
`%USERPROFILE%\.config\opencode\plugins\capri-opencode.js`.

Without the app:

```bash
node scripts/install-plugin.js          # from the repo root
node scripts/install-plugin.js --status
node scripts/install-plugin.js --uninstall
```

or run `install.bat` in this folder.

Restart OpenCode afterwards: it loads plugins at startup. Keep Capri running;
when it isn't, the POST fails silently and OpenCode is unaffected.

Port override: set `CAPRI_PORT` before starting OpenCode.

## What she sees

| OpenCode | Capri |
|---|---|
| `session.created` | `SessionStart` (hello) |
| `chat.message` | `UserPromptSubmit` |
| `tool.execute.before` | `PreToolUse` (ticker, sparks, tool count) |
| `message.part.updated` tool error | `PostToolUseFailure` |
| `permission.updated` / `permission.asked` | `Notification` (she comes to you) |
| `session.idle` | `Stop` (victory, summary, last answer) |
| `session.error` (not Esc) | `StopFailure` |
| `session.compacted` | `PreCompact` |
| `session.deleted` | `SessionEnd` |

Subagent sessions (children) are ignored: the parent's `task` call already shows
in her ticker, and their `session.idle` would trigger an early celebration.
Tool names and args are mapped to Claude Code's (`edit`→`Edit`,
`filePath`→`file_path`), so her labels and file counts work unchanged.

## Check

```bash
node integrations/opencode/test_selfcheck.mjs
```

## Limits

- Esc (aborted run) is ignored on purpose: that's you, not a crash.
- No separate subagent ticker.
- Window tracking (sitting on windows, pointing at them) is Capri's own Windows
  helper and works on OpenCode's window like any other.
