'use strict';

// Spotify, so her chat can play a track or add it to the queue: OAuth (PKCE, no client secret),
// the tokens kept encrypted with the Windows account, then the Web API. Premium is required by
// Spotify for playback and queue control; search alone works for everyone.

const http = require('node:http');
const crypto = require('node:crypto');
const { shell, safeStorage } = require('electron');
const config = require('./config');

const AUTH = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
const PORT = 47824;
const REDIRECT = `http://127.0.0.1:${PORT}/spotify/callback`;
const SCOPES = 'user-read-private user-modify-playback-state user-read-playback-state';
const WAIT_MS = 3 * 60 * 1000;

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const seal = (text) => (safeStorage.isEncryptionAvailable()
  ? `enc:${safeStorage.encryptString(text).toString('base64')}`
  : text);

function unseal(stored) {
  if (!stored) return null;
  try {
    return stored.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64')) : stored;
  } catch {
    return null;
  }
}

function auth() {
  const raw = unseal(config.load().spotifyAuth);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAuth(tokens) {
  config.save({ spotifyAuth: seal(JSON.stringify(tokens)) });
}

function status() {
  const cfg = config.load();
  const a = auth();
  return {
    clientId: cfg.spotifyClientId || '',
    connected: Boolean(a?.refreshToken || a?.accessToken),
    name: a?.name || '',
    product: a?.product || '',
    redirect: REDIRECT,
  };
}

function setClientId(value) {
  const id = String(value || '').trim();
  if (!/^[0-9a-f]{32}$/i.test(id)) throw new Error('a Spotify Client ID is 32 hex characters');
  config.save({ spotifyClientId: id });
}

function disconnect() {
  config.save({ spotifyAuth: '' });
  return { ok: true };
}

async function tokenRequest(params) {
  const res = await fetch(`${AUTH}/api/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error_description || json?.error || `Spotify token error (${res.status})`);
  return json;
}

async function accessToken(force = false) {
  const a = auth();
  if (!a) throw Object.assign(new Error('Spotify is not connected'), { code: 'not_connected' });
  if (!force && a.accessToken && a.expiresAt && a.expiresAt > Date.now() + 60000) return a.accessToken;
  if (!a.refreshToken) throw Object.assign(new Error('Spotify is not connected'), { code: 'not_connected' });
  const t = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: a.refreshToken,
    client_id: config.load().spotifyClientId,
  }).catch((err) => {
    throw Object.assign(err, { code: 'not_connected' });
  });
  saveAuth({
    ...a,
    accessToken: t.access_token,
    expiresAt: Date.now() + t.expires_in * 1000,
    refreshToken: t.refresh_token || a.refreshToken,
  });
  return t.access_token;
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 204 || res.status === 202) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const reason = json?.error?.reason || '';
    const code = reason === 'PREMIUM_REQUIRED' ? 'premium'
      : reason === 'NO_ACTIVE_DEVICE' ? 'no_device'
        : res.status === 401 ? 'auth'
          : res.status === 404 ? 'no_device'
            : res.status === 403 ? 'forbidden'
              : 'api';
    throw Object.assign(new Error(json?.error?.message || `Spotify ${res.status}`), { code });
  }
  return json;
}

async function withToken(method, path, body) {
  let token = await accessToken();
  try {
    return await api(token, method, path, body);
  } catch (err) {
    if (err.code !== 'auth') throw err;
    token = await accessToken(true);
    return api(token, method, path, body);
  }
}

function waitForCode(state, url) {
  return new Promise((resolve, reject) => {
    let over = false;
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
      if (u.pathname !== '/spotify/callback') {
        res.writeHead(404).end();
        return;
      }
      const done = (line) => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><body style="background:#150e20;color:#dcd2f5;font:16px system-ui;padding:2rem">${line}</body>`);
      };
      if (u.searchParams.get('state') !== state) {
        done('State mismatch. Close this window and try again.');
        finish(new Error('Spotify sent the wrong state: try again'));
        return;
      }
      if (u.searchParams.get('error')) {
        done('Spotify said no. Close this window and try again.');
        finish(new Error(u.searchParams.get('error')));
        return;
      }
      const code = u.searchParams.get('code');
      if (!code) {
        done('No code from Spotify. Close this window and try again.');
        finish(new Error('Spotify gave no code'));
        return;
      }
      done('Spotify is connected. You can close this window.');
      finish(null, code);
    });
    const timer = setTimeout(() => finish(new Error('Spotify login timed out')), WAIT_MS);
    function finish(err, code) {
      if (over) return;
      over = true;
      clearTimeout(timer);
      try { server.close(); } catch { /* already closed */ }
      if (err) reject(err);
      else resolve(code);
    }
    server.on('error', (err) => finish(err));
    server.listen(PORT, '127.0.0.1', () => shell.openExternal(url).catch((err) => finish(err)));
  });
}

let connecting = null;

function connect() {
  if (connecting) return connecting;
  connecting = (async () => {
    const clientId = config.load().spotifyClientId;
    if (!clientId) return { ok: false, code: 'noclient', error: 'Spotify Client ID missing' };
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(16));
    const url = `${AUTH}/authorize?`
      + `client_id=${encodeURIComponent(clientId)}`
      + '&response_type=code'
      + `&redirect_uri=${encodeURIComponent(REDIRECT)}`
      + `&scope=${encodeURIComponent(SCOPES)}`
      + '&code_challenge_method=S256'
      + `&code_challenge=${challenge}`
      + `&state=${state}`
      + '&show_dialog=true';
    try {
      const code = await waitForCode(state, url);
      const t = await tokenRequest({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT,
        client_id: clientId,
        code_verifier: verifier,
      });
      const me = await api(t.access_token, 'GET', '/me');
      saveAuth({
        accessToken: t.access_token,
        refreshToken: t.refresh_token,
        expiresAt: Date.now() + t.expires_in * 1000,
        name: me.display_name || me.id,
        product: me.product || '',
        id: me.id,
      });
      return { ok: true, name: me.display_name || me.id, product: me.product || '' };
    } catch (err) {
      return { ok: false, code: err.code || 'auth', error: err.message };
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

const strip = (text) => String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const wordsOf = (text) => strip(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

async function searchTrack(query) {
  const q = String(query || '').trim().replace(/^["“”']+|["“”']+$/g, '').slice(0, 200);
  if (!q) throw Object.assign(new Error('no track'), { code: 'notfound' });
  const find = async (text) => {
    const data = await withToken('GET', `/search?type=track&limit=5&q=${encodeURIComponent(text)}`);
    return data?.tracks?.items || [];
  };
  const score = (items) => {
    const said = wordsOf(q);
    const poolOf = (item) => new Set([...wordsOf(item.name), ...(item.artists || []).flatMap((a) => wordsOf(a.name))]);
    return items.reduce((best, item) => {
      if (!item?.uri) return best;
      const name = wordsOf(item.name);
      const artists = (item.artists || []).flatMap((a) => wordsOf(a.name));
      const pool = poolOf(item);
      const hits = said.filter((w) => pool.has(w)).length;
      const nameHits = said.filter((w) => name.includes(w)).length;
      const artistHits = said.filter((w) => artists.includes(w)).length;
      const cover = name.length ? name.filter((w) => said.includes(w)).length / name.length : 0;
      const value = nameHits * 2 + artistHits * 1.5 + hits + cover * 2;
      return !best || value > best.value ? { item, value } : best;
    }, null);
  };
  let best = score(await find(q));
  // A full phrase ("song by artist") can rank badly: try the exact words once.
  if (!best || best.value < 2) {
    const exact = score(await find(`"${q}"`));
    if (exact && (!best || exact.value > best.value)) best = exact;
  }
  if (!best) throw Object.assign(new Error(`No Spotify track found for "${q}"`), { code: 'notfound' });
  const track = best.item;
  return {
    uri: track.uri,
    name: track.name,
    artist: (track.artists || []).map((a) => a.name).join(', '),
  };
}

async function pickDevice() {
  const data = await withToken('GET', '/me/player/devices');
  const devices = data?.devices || [];
  const device = devices.find((d) => d.is_active) || devices[0];
  if (!device) throw Object.assign(new Error('Open Spotify and start something once'), { code: 'no_device' });
  return device;
}

async function wakeDevice() {
  const device = await pickDevice();
  await withToken('PUT', '/me/player', { device_ids: [device.id], play: true });
  return device;
}

function failed(err) {
  const code = err.code || 'api';
  const text = code === 'premium' ? 'Spotify Premium is needed to start playback or queue'
    : code === 'no_device' ? 'Open Spotify and start something once, then try again'
      : code === 'not_connected' ? 'Spotify is not connected'
        : err.message;
  return { ok: false, code, error: text };
}

async function openTrack(uri) {
  try {
    await shell.openExternal(uri);
    return true;
  } catch {
    return false;
  }
}

async function play(query) {
  try {
    const token = await accessToken();
    const track = await searchTrack(query);
    try {
      await api(token, 'PUT', '/me/player/play', { uris: [track.uri] });
    } catch (err) {
      if (err.code === 'not_connected' || err.code === 'auth') throw err;
      // Premium or no woken device: the app can still open the track itself.
      if (!(await openTrack(track.uri))) return failed(err);
      return { ok: true, track, via: 'app' };
    }
    // The desktop client sometimes accepts the command and does nothing (stale Connect
    // session): check it really started, else open the track in the app.
    await new Promise((resolve) => setTimeout(resolve, 900));
    const state = await api(token, 'GET', '/me/player').catch(() => null);
    if (state?.is_playing && state.item?.uri === track.uri) return { ok: true, track };
    if (await openTrack(track.uri)) return { ok: true, track, via: 'app' };
    return failed(Object.assign(new Error('Spotify accepted the command but did not start playing'), { code: 'silent' }));
  } catch (err) {
    return failed(err);
  }
}

async function queue(query) {
  try {
    const token = await accessToken();
    const track = await searchTrack(query);
    const add = () => api(token, 'POST', `/me/player/queue?uri=${encodeURIComponent(track.uri)}`);
    try {
      await add();
    } catch (err) {
      if (err.code !== 'no_device') throw err;
      await wakeDevice();
      await add();
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
    const q = await api(token, 'GET', '/me/player/queue').catch(() => null);
    if (q?.queue && !q.queue.some((item) => item.uri === track.uri)) {
      return { ok: false, code: 'queue', error: 'Spotify did not queue it (no active device?)' };
    }
    return { ok: true, track };
  } catch (err) {
    return failed(err);
  }
}

const openDashboard = () => shell.openExternal('https://developer.spotify.com/dashboard');

async function control(action) {
  try {
    const token = await accessToken();
    if (action === 'next') await api(token, 'POST', '/me/player/next');
    else if (action === 'previous') await api(token, 'POST', '/me/player/previous');
    else if (action === 'pause') await api(token, 'PUT', '/me/player/pause');
    else if (action === 'play') await api(token, 'PUT', '/me/player/play');
    else if (action === 'restart') await api(token, 'PUT', '/me/player/seek?position_ms=0');
    else return { ok: false, code: 'unsupported', error: 'unknown media action' };
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

module.exports = { status, setClientId, connect, disconnect, play, queue, control, openDashboard, redirect: REDIRECT };
