# TODO

## OpenCode as the terminal-agent chat provider

Add an **"OpenCode (sends to the terminal agent)"** entry next to Claude Code: Capri's chat sends
messages to `opencode run` instead of Ollama or an OpenAI-compatible endpoint.

Mapping: `opencode run --session <uuid> --title Capri --format json [--model provider/model] [--auto]`

- [ ] Spike: `opencode run --format json` schema (events and text streaming)
- [ ] Spike: prompt over stdin; fallback `--file` or `OPENCODE_CONFIG_CONTENT`
- [ ] Spike: `--session <uuid>` really creates the session
- [ ] Spike: what an `ask` permission does headless (blocks or fails)
- [ ] `opencode` provider in `src/main/llm.js`: spawn, models from `opencode models`, session memory
- [ ] `opencodeCwd` + `opencodeMode` in `src/main/config.js`
- [ ] Tray menu: OpenCode folder and permissions, as for Claude Code
- [ ] `isChatSession` must recognise `opencode:<session>` (no self-reactions)
- [ ] "Under the hood you are OpenCode" persona in `src/renderer/js/chat.js`
- [ ] Read-only default (`edit`/`bash`/`webfetch` deny), `--auto` only on request
- [ ] Test: session continuity, stop, forget, no duplicate events

### Open decisions

- Default permissions: read-only (recommended) or `--auto`?
- Model: "OpenCode default" as the first entry, or force an explicit choice?
- Working folder: user home or the current OpenCode project?

### Risks

- The chat creates sessions visible in OpenCode's session list (as Claude Code already does).
- `--auto` can edit files and run commands: it must not be the default.
- Cost depends on the model chosen in OpenCode.
