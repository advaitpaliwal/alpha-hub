import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';

const CLERK_ISSUER = 'https://clerk.alphaxiv.org';
const AUTH_ENDPOINT = `${CLERK_ISSUER}/oauth/authorize`;
const TOKEN_ENDPOINT = `${CLERK_ISSUER}/oauth/token`;
const REGISTER_ENDPOINT = `${CLERK_ISSUER}/oauth/register`;
const CALLBACK_PORT = 9876;
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`;
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

function openBrowser(url) {
  const plat = platform();
  if (plat === 'darwin') execSync(`open "${url}"`);
  else if (plat === 'linux') execSync(`xdg-open "${url}"`);
  else if (plat === 'win32') execSync(`start "${url}"`);
}

function waitForCallback(server) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Login timed out after 120 seconds'));
    }, 120000);

    server.on('request', (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${CALLBACK_PORT}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Login failed</h2><p>You can close this tab.</p></body></html>');
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Logged in to Alpha Hub</h2><p>You can close this tab.</p></body></html>');
        clearTimeout(timeout);
        server.close();
        resolve(code);
      }
    });
  });
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

export async function login() {
  const registration = await registerClient();
  const clientId = registration.client_id;
  const { verifier, challenge } = generatePKCE();

  const state = randomBytes(16).toString('hex');

  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);

  const server = createServer();
  server.listen(CALLBACK_PORT);

  process.stderr.write('Opening browser for alphaXiv login...\n');
  openBrowser(authUrl.toString());
  process.stderr.write(`If browser didn't open, visit:\n${authUrl.toString()}\n\n`);
  process.stderr.write('Waiting for login...\n');

  const code = await waitForCallback(server);

  const tokens = await exchangeCode(code, clientId, verifier);

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

export function isLoggedIn() {
  return !!getAccessToken();
}

export function logout() {
  try {
    writeFileSync(getAuthPath(), '{}', 'utf8');
  } catch {
  }
}
