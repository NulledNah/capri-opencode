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
  assert.deepEqual(chat.asked('passa alla successiva'), { kind: 'media', action: 'next' });
  assert.deepEqual(chat.asked('metti la prossima'), { kind: 'media', action: 'next' });
  assert.deepEqual(chat.asked('torna alla precedente'), { kind: 'media', action: 'previous' });
  assert.deepEqual(chat.asked('rimettila da capo'), { kind: 'media', action: 'restart' });
  assert.deepEqual(chat.asked('ricomincia la canzone'), { kind: 'media', action: 'restart' });

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
  assert.deepEqual(chat.asked('metti in coda 2003 di bello figo su spotify'), { kind: 'queue', song: '2003 di bello figo' });
  assert.deepEqual(chat.asked('metti in coda 2003 di bello figo'), { kind: 'queue', song: '2003 di bello figo' });
  assert.deepEqual(chat.asked('aggiungi alla coda 2003 di bello figo'), { kind: 'queue', song: '2003 di bello figo' });
  assert.deepEqual(chat.asked('accoda 2003 di bello figo'), { kind: 'queue', song: '2003 di bello figo' });
  assert.deepEqual(chat.asked('add 2003 by Bello Figo to the queue'), { kind: 'queue', song: '2003 by Bello Figo' });
  assert.equal(chat.asked('metti 2003 di bello figo su spotify')?.kind, 'music');
  assert.equal(chat.asked('metti in coda'), null);

  assert.equal(chat.asked('aprile'), null); // "apri" is not a prefix match
  assert.equal(chat.asked('chiacchiero'), null); // nor is "chiudi"
});

test('short repeat phrases re-run the last action', async () => {
  const { Chat } = await import(moduleUrl(path.join(__dirname, '../src/renderer/js/chat.js')));
  const chat = Object.create(Chat.prototype);
  assert.equal(chat.asked('di nuovo'), null); // nothing done yet

  chat.last = { kind: 'media', action: 'next' };
  for (const text of ['di nuovo', 'ancora', 'ancora una volta', 'ripeti', 'rifallo', 'again']) {
    assert.deepEqual(chat.asked(text), { kind: 'media', action: 'next', repeat: true }, text);
  }
  assert.equal(chat.asked('di nuovo, per favore'), null);

  chat.last = { kind: 'music', song: '2003 di bello figo' };
  assert.deepEqual(chat.asked('di nuovo'), { kind: 'music', song: '2003 di bello figo', repeat: true });
});
