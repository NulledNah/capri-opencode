'use strict';

// The plain-language actions, without a browser: what she does is decided in `asked()`.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const moduleUrl = (file) => pathToFileURL(file).href;

test('Italian verbs open, close and control music', async () => {
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  const { Chat } = await import(moduleUrl(path.join(__dirname, '../src/renderer/js/chat.js')));
  const chat = Object.create(Chat.prototype);
  chat.apps = [];

  for (const text of [
    'apri Rocket League',
    'avvia Rocket League',
    'lancia Rocket League',
    'fai partire Rocket League',
    'fammi partire Rocket League',
  ]) {
    assert.equal(chat.asked(text)?.kind, 'open', text);
  }

  chat.apps = [{ name: 'Discord', label: 'Discord' }];
  for (const text of ['chiudi Discord', 'chiudere Discord', 'termina Discord']) {
    assert.deepEqual(chat.asked(text), { kind: 'close', name: 'Discord' }, text);
  }

  assert.deepEqual(chat.asked('alza il volume'), { kind: 'media', action: 'volup' });
  assert.deepEqual(chat.asked('abbassa il volume'), { kind: 'media', action: 'voldown' });
  assert.deepEqual(chat.asked('canzone precedente'), { kind: 'media', action: 'previous' });
  assert.deepEqual(chat.asked('metti in pausa la musica'), { kind: 'media', action: 'pause' });

  for (const text of [
    'metti Run the Jewels su Spotify',
    'riproduci Daft Punk su Spotify',
    'ascolta i Maneskin su Spotify',
    'riproduci Daft Punk',
  ]) {
    assert.equal(chat.asked(text)?.kind, 'music', text);
  }

  assert.deepEqual(chat.asked('aggiungi Run the Jewels alla coda'), { kind: 'queue', song: 'Run the Jewels' });
  assert.deepEqual(chat.asked('metti Daft Punk in coda'), { kind: 'queue', song: 'Daft Punk' });

  assert.equal(chat.asked('aprile'), null); // "apri" is not a prefix match
  assert.equal(chat.asked('chiacchiero'), null); // nor is "chiudi"
});
