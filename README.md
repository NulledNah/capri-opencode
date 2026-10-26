# Capri for opencode

Lets [Capri](https://github.com/mochiiwuff/capri-desktop) — the Cyberpunk:
Edgerunners 2 construct who lives on your desktop — watch **opencode** instead of
Claude Code.

No fork, no `app.asar` patch. One plugin file translates opencode events into the
Claude Code hook events Capri already understands and POSTs them to her local
bridge (`127.0.0.1:47823`). When Capri isn't running the POST fails silently and
opencode is unaffected.

## Requirements

- [Capri](https://github.com/mochiiwuff/capri-desktop/releases/latest) installed
  and running (the Windows installer is enough; don't install her Claude Code
  hooks).
- opencode (CLI or desktop).

## Install

    install.bat

or copy `capri-opencode.js` to `%USERPROFILE%\.config\opencode\plugins\` and
restart opencode.

Port override: set `CAPRI_PORT` before starting opencode.

## What she sees

| opencode | Capri |
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

Tool names and args are mapped to Claude Code's (`edit`→`Edit`,
`filePath`→`file_path`), so her labels and file counts work unchanged.

## Check

    node test_selfcheck.mjs

## Limits

- Esc (aborted run) is ignored on purpose: that's you, not a crash.
- Subagent (`task`) calls show as normal tools; there is no separate
  subagent start/stop ticker.
- Window tracking (sitting on your windows, pointing at them) is Capri's own
  Windows helper and works on any window, opencode included.
