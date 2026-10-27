'use strict';

// The coding assistants she can watch, each through its own integration: Claude Code and Codex
// through hooks, Antigravity through its hooks, OpenCode through Capri's plugin.

const fs = require('node:fs');
const path = require('node:path');
const claude = require('../../scripts/install-hooks');
const codex = require('../../scripts/install-codex-hooks');
const agy = require('../../scripts/install-hooks-agy');
const opencode = require('./plugin');

const ASSISTANTS = {
  claude: { name: 'Claude Code', hooks: claude, help: 'https://code.claude.com/docs/en/quickstart' },
  codex: { name: 'Codex', hooks: codex, help: 'https://learn.chatgpt.com/docs/hooks' },
  agy: { name: 'Antigravity', hooks: agy, help: 'https://antigravity.google/docs/hooks' },
  opencode: { name: 'OpenCode', hooks: opencode, help: 'https://opencode.ai/docs/', folder: opencode.folder },
};

// Which one she watches: the one picked, else the one her integration is in, else the one that's installed.
function resolveAssistant(preference) {
  if (ASSISTANTS[preference]) return preference;
  if (codex.status().events.length) return 'codex';
  if (claude.status().installed) return 'claude';
  if (agy.status().installed) return 'agy';
  if (opencode.status().installed) return 'opencode';
  if (fs.existsSync(path.dirname(codex.status().file))) return 'codex';
  if (fs.existsSync(opencode.folder().dir)) return 'opencode';
  return 'claude';
}

function assistant(preference) {
  const id = resolveAssistant(preference);
  return { id, ...ASSISTANTS[id] };
}

module.exports = { ASSISTANTS, assistant, resolveAssistant };
