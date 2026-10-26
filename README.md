# Capri for OpenCode

Capri, the *Project Capricorn* construct from Cyberpunk: Edgerunners season 2,
living on your desktop and telling you what **OpenCode** is up to.

This is a fork of [mochiiwuff/capri-desktop](https://github.com/mochiiwuff/capri-desktop)
that watches OpenCode instead of Claude Code: same character, same animations,
same menu, different assistant. Credits, art direction and the full tour of what
she does are in the upstream README.

## How it works

OpenCode loads a small plugin that translates its events into the hook events
Capri already understands and posts them to her local bridge
(`127.0.0.1:47823`). No `app.asar` patch, no fork of OpenCode. The plugin is in
[`integrations/opencode/`](integrations/opencode/README.md).

## Requirements

- [OpenCode](https://opencode.ai/docs/) installed (CLI or desktop).
- Node.js 20 or newer to run her from source.
- [Ollama](https://ollama.com) only if you want to talk to her.

## Run from source

```bash
npm install
npm start
```

## Plug her into OpenCode

On first launch she offers **Plug me in**: one click copies
`capri-opencode.js` into `%USERPROFILE%\.config\opencode\plugins\`.
Then restart OpenCode (it loads plugins at startup). Her tray menu has the same
buttons:

- *Install OpenCode plugin*
- *Remove OpenCode plugin*

From a terminal, without the app:

```bash
npm run plugin:install
npm run plugin:uninstall
```

Or run `integrations/opencode/install.bat`.

## What she watches

| OpenCode | Capri |
|---|---|
| `session.created` / `session.deleted` | hello / goodbye |
| user prompt | her "new gig" line |
| tool calls | ticker, sparks, action count, files changed |
| tool errors | impact, glitch, the error line that matters |
| permission requests | she comes to you |
| `session.idle` | victory sequence, summary, last answer |
| `session.error` | crash line |

Subagent sessions are ignored so they don't double-count or celebrate early.
Esc (aborted run) is not treated as a crash.

## Build the installer

```bash
npm run dist
```

The Windows build ends up in `dist/`. The app id is the upstream one
(`capri.desktop`), so uninstall the official Capri before installing this fork if
you had it.

## Differences from upstream

- User-facing strings say **OpenCode** (a runtime layer rewrites upstream's
  strings, so upstream line files stay mergeable).
- The Claude Code hook is replaced by the OpenCode plugin, installed from her
  menu, `npm run plugin:install` or `install.bat`.
- "OpenCode's folder" points at `%USERPROFILE%\.config\opencode`, not `~/.claude`.
- English and Italian are written by hand; French, Spanish, Portuguese and
  Russian get the name swapped mechanically.

## Check

```bash
node integrations/opencode/test_selfcheck.mjs
```

## Credits and rights

Capri / Project Capricorn, Cyberpunk and Cyberpunk: Edgerunners belong to CD
PROJEKT RED, Studio Trigger and Netflix. This is a non-commercial fan project
with no affiliation. The character images in `assets/capri/` come from frames of
the show, a fan-made cut-out and fan art; they are **not** covered by the code's
MIT license. If a rights holder wants them removed, open an issue.

Code: MIT (see `LICENSE`). Upstream: mochiiwuff/capri-desktop.
