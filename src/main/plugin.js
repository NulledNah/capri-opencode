'use strict';

// The OpenCode integration: Capri watches OpenCode through a plugin that posts
// her events to the local bridge. "Install" copies the bundled plugin into
// OpenCode's plugins folder, "Remove" deletes it. Nothing else is touched.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FILE = 'capri-opencode.js';
const SOURCE = path.resolve(__dirname, '..', '..', 'integrations', 'opencode', FILE);

function configDir() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'opencode');
}

function pluginsDir() {
  return path.join(configDir(), 'plugins');
}

function target() {
  return path.join(pluginsDir(), FILE);
}

function status() {
  const file = target();
  return { file, installed: fs.existsSync(file) };
}

function install() {
  const file = target();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(SOURCE, file);
  return { file };
}

function uninstall() {
  const file = target();
  let removed = false;
  try {
    fs.unlinkSync(file);
    removed = true;
  } catch { /* not installed */ }
  return { file, removed };
}

// What her guide opens: opencode.json when it exists, the plugins folder otherwise.
function folder() {
  const dir = configDir();
  const settings = path.join(dir, 'opencode.json');
  const hasSettings = fs.existsSync(settings);
  return { dir, label: hasSettings ? 'opencode.json' : 'plugins', hasSettings };
}

module.exports = { status, install, uninstall, folder, target };
