import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { createInterface } from 'node:readline/promises';

const CLERK_ISSUER = 'https://clerk.alphaxiv.org';
const AUTH_ENDPOINT = `${CLERK_ISSUER}/oauth/authorize`;
const TOKEN_ENDPOINT = `${CLERK_ISSUER}/oauth/token`;
const REGISTER_ENDPOINT = `${CLERK_ISSUER}/oauth/register`;
const CALLBACK_PORT = 9876;
const CALLBACK_PATH = '/callback';
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`;
const USERINFO_ENDPOINT = `${CLERK_ISSUER}/oauth/userinfo`;
const SCOPES = 'profile email offline_access';

function getAuthPath() {
  const dir = join(homedir(), '.ahub');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'auth.json');
}

function loadAuth() {
  try {
    return JSON.parse(readFileSync(getAuthPath(), 'utf8'));
  } catch {
    return null;
  }
}

function saveAuth(data) {
  writeFileSync(getAuthPath(), JSON.stringify(data, null, 2), 'utf8');
}

export function getAccessToken() {
  const auth = loadAuth();
  if (!auth?.access_token) return null;
  return auth.access_token;
}

export function getUserId() {
  const auth = loadAuth();
  return auth?.user_id || null;
}

export function getUserName() {
  const auth = loadAuth();
  return auth?.user_name || null;
}

export function getUserEmail() {
  const auth = loadAuth();
  return auth?.user_email || null;
}

export function hasSavedAuth() {
  return !!getAccessToken();
}

async function fetchUserInfo(accessToken) {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

async function registerClient() {
  const res = await fetch(REGISTER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Alpha Hub CLI',
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });

  if (!res.ok) throw new Error(`Client registration failed: ${res.status}`);
  return await res.json();
}

function generatePKCE() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function buildAuthUrl(clientId, challenge, state) {
  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  return authUrl;
}

function openBrowser(url) {
  try {
    const plat = platform();
    if (plat === 'darwin') execSync(`open "${url}"`);
    else if (plat === 'linux') execSync(`xdg-open "${url}"`);
    else if (plat === 'win32') execSync(`start "" "${url}"`);
  } catch {}
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>alphaXiv</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #e5e5e5; }
  .card { text-align: center; padding: 2rem; }
  h2 { color: #10b981; margin-bottom: 0.5rem; }
  p { color: #737373; }
</style>
</head>
<body><div class="card"><h2>Logged in to alphaXiv</h2><p>You can close this tab</p></div>
<script>setTimeout(function(){window.close()},2000)</script>
</body></html>`;

const ERROR_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>alphaXiv</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #e5e5e5; }
  .card { text-align: center; padding: 2rem; }
  h2 { color: #ef4444; margin-bottom: 0.5rem; }
  p { color: #737373; }
</style>
</head>
<body><div class="card"><h2>Login failed</h2><p>You can close this tab and try again</p></div></body></html>`;

function startCallbackServer() {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${CALLBACK_PORT} is already in use. Close the process using it and try again.`));
      } else {
        reject(err);
      }
    });

    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

function waitForCallback(server) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Login timed out after 120 seconds'));
    }, 120000);

    server.on('request', (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${CALLBACK_PORT}`);

      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }

      try {
        const callback = parseCallbackUrl(url.toString());
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(SUCCESS_HTML);
        clearTimeout(timeout);
        server.close();
        resolve(callback);
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML);
        clearTimeout(timeout);
        server.close();
        reject(err);
      }
    });
  });
}

function normalizeCallbackInput(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('No callback URL provided.');
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith(CALLBACK_PATH)) {
    return `http://127.0.0.1:${CALLBACK_PORT}${trimmed}`;
  }

  if (trimmed.startsWith('?')) {
    return `${REDIRECT_URI}${trimmed}`;
  }

  if (trimmed.includes('code=')) {
    return `${REDIRECT_URI}?${trimmed.replace(/^\?/, '')}`;
  }

  throw new Error('Paste the full callback URL, callback path, or query string from the browser redirect.');
}

function parseCallbackUrl(input) {
  const normalizedInput = normalizeCallbackInput(input);
  let url;
  try {
    url = new URL(normalizedInput);
  } catch {
    throw new Error('Invalid callback URL. Paste the full redirected URL from the browser.');
  }

  if (url.pathname !== CALLBACK_PATH) {
    throw new Error(`Callback URL must point to ${CALLBACK_PATH}.`);
  }

  const error = url.searchParams.get('error');
  if (error) {
    throw new Error(`OAuth error: ${error}`);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) {
    throw new Error('Callback URL does not include an authorization code.');
  }

  return { code, state };
}

function validateCallbackState(expectedState, callbackState) {
  if (!callbackState) {
    throw new Error('Callback URL does not include an OAuth state parameter.');
  }

  if (callbackState !== expectedState) {
    throw new Error('OAuth state mismatch. Start `alpha login` again and retry.');
  }
}

async function promptForCallbackUrl() {
  process.stderr.write('Complete sign-in in a browser on any machine.\n');
  process.stderr.write('When the browser is redirected to the localhost callback and the page fails to load, copy the full URL from the address bar and paste it below.\n\n');

  const readline = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  try {
    const callbackUrl = await readline.question('Paste callback URL: ');
    return callbackUrl.trim();
  } finally {
    readline.close();
  }
}

async function exchangeCode(code, clientId, codeVerifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  return await res.json();
}

export async function refreshAccessToken() {
  const auth = loadAuth();
  if (!auth?.refresh_token || !auth?.client_id) return null;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refresh_token,
    client_id: auth.client_id,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) return null;

  const tokens = await res.json();
  saveAuth({
    ...auth,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || auth.refresh_token,
    expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : auth.expires_at,
  });

  return tokens.access_token;
}

export async function login(options = {}) {
  const { headless = false } = options;
  const registration = await registerClient();
  const clientId = registration.client_id;
  const { verifier, challenge } = generatePKCE();

  const state = randomBytes(16).toString('hex');
  const authUrl = buildAuthUrl(clientId, challenge, state);

  let callback;
  if (headless) {
    process.stderr.write('Starting headless alphaXiv login...\n');
    process.stderr.write(`Open this URL in a browser:\n${authUrl.toString()}\n\n`);
    const callbackUrl = await promptForCallbackUrl();
    callback = parseCallbackUrl(callbackUrl);
  } else {
    const server = await startCallbackServer();

    process.stderr.write('Opening browser for alphaXiv login...\n');
    openBrowser(authUrl.toString());
    process.stderr.write(`If browser didn't open, visit:\n${authUrl.toString()}\n\n`);
    process.stderr.write('Waiting for login...\n');

    callback = await waitForCallback(server);
  }

  validateCallbackState(state, callback.state);

  const tokens = await exchangeCode(callback.code, clientId, verifier);

  const userInfo = await fetchUserInfo(tokens.access_token);

  saveAuth({
    client_id: clientId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
    user_id: userInfo?.sub || null,
    user_name: userInfo?.name || userInfo?.preferred_username || null,
    user_email: userInfo?.email || null,
  });

  return { tokens, userInfo };
}

export async function getValidToken() {
  let token = getAccessToken();
  if (token) {
    const auth = loadAuth();
    if (auth?.expires_at && Date.now() > auth.expires_at - 60000) {
      token = await refreshAccessToken();
    }
    if (token) return token;
  }
  return null;
}

export async function getLoginState() {
  const auth = loadAuth();
  if (!auth?.access_token) {
    return 'missing';
  }

  const token = await getValidToken();
  if (token) {
    return 'valid';
  }

  if (auth?.expires_at && Date.now() > auth.expires_at - 60000) {
    return 'expired';
  }

  return 'invalid';
}

export function isLoggedIn() {
  return hasSavedAuth();
}

export function logout() {
  try {
    writeFileSync(getAuthPath(), '{}', 'utf8');
  } catch {
  }
}
