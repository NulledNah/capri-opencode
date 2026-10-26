#!/usr/bin/env node
'use strict';

// Copies (or removes) the Capri plugin in OpenCode's plugins folder.
//
//   node scripts/install-plugin.js             install
//   node scripts/install-plugin.js --uninstall
//   node scripts/install-plugin.js --status

const plugin = require('../src/main/plugin');

if (require.main === module) {
  const arg = process.argv[2];
  try {
    if (arg === '--uninstall') {
      const r = plugin.uninstall();
      console.log(r.removed ? `Capri plugin removed from ${r.file}` : `No Capri plugin found in ${r.file}`);
    } else if (arg === '--status') {
      const r = plugin.status();
      console.log(r.installed ? `Installed in ${r.file}` : `Not installed (${r.file})`);
    } else {
      const r = plugin.install();
      console.log(`Capri plugin installed in ${r.file}`);
      console.log('Restart OpenCode: it loads plugins at startup.');
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
