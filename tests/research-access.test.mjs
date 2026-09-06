import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadSource } from './helpers/load-source.mjs';

const plain = (value) => JSON.parse(JSON.stringify(value));
const modern = '1. [ID=1706.03762] **Attention Is All You Need**. Published 2017-06-12 by Example Lab: Transformer abstract.';

function mockAuth({ state = 'valid' } = {}) {
  const files = new Map();
  const calls = [];
  let opened;
  let callbackResponse;
  const server = new EventEmitter();
  server.listen = (_port, _host, callback) => callback();
  server.close = () => {};
  const stubs = {
    'node:fs': {
      existsSync: (file) => files.has(file),
      mkdirSync() {},
      readFileSync: (file) => { if (!files.has(file)) throw new Error('ENOENT'); return files.get(file); },
      writeFileSync: (file, content) => files.set(file, content),
    },
    'node:os': { homedir: () => '/mock-home', platform: () => 'darwin' },
    'node:http': { createServer: () => server },
    'node:child_process': {
      execSync: (command) => {
        opened = new URL(command.match(/^open "(.+)"$/)[1]);
        queueMicrotask(() => {
          const url = new URL('http://127.0.0.1:9876/callback?code=mock-code');
          if (state !== 'missing') url.searchParams.set('state', state === 'valid' ? opened.searchParams.get('state') : 'wrong');
          server.emit('request', { url: url.pathname + url.search }, {
            writeHead: (status) => { callbackResponse = status; }, end() {},
          });
        });
      },
    },
  };
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), ...options });
    if (url === 'https://api.alphaxiv.org/auth/oauth2/register') {
      return { ok: true, json: async () => ({ client_id: 'mock-client' }) };
    }
    if (url === 'https://api.alphaxiv.org/auth/oauth2/token') {
      return { ok: true, json: async () => ({ access_token: 'mock-access', refresh_token: 'mock-refresh', expires_in: 3600 }) };
    }
    if (url === 'https://api.alphaxiv.org/auth/oauth2/userinfo') {
      return { ok: true, json: async () => ({ sub: 'mock-user', name: 'Mock User' }) };
    }
    throw new Error(`Unexpected endpoint: ${url}`);
  };
  return { stubs, globals: { fetch }, files, calls, opened: () => opened, callbackStatus: () => callbackResponse };
}

test('OAuth login executes current registration, authorize, token and userinfo flow with PKCE/state', async () => {
  const mock = mockAuth();
  const auth = await loadSource('../../cli/src/lib/auth.js', mock);
  const result = await auth.login();
  assert.equal(result.userInfo.name, 'Mock User');
  const opened = mock.opened();
  assert.equal(opened.origin + opened.pathname, 'https://api.alphaxiv.org/auth/oauth2/authorize');
  assert.equal(opened.searchParams.get('scope'), 'openid profile email offline_access');
  assert.equal(opened.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(opened.searchParams.get('code_challenge'));
  assert.ok(opened.searchParams.get('state'));
  assert.equal(opened.searchParams.get('redirect_uri'), 'http://127.0.0.1:9876/callback');
  assert.equal(mock.callbackStatus(), 200);
  assert.deepEqual(mock.calls.map((call) => call.url), [
    'https://api.alphaxiv.org/auth/oauth2/register',
    'https://api.alphaxiv.org/auth/oauth2/token',
    'https://api.alphaxiv.org/auth/oauth2/userinfo',
  ]);
  const registration = JSON.parse(mock.calls[0].body);
  assert.equal(registration.token_endpoint_auth_method, 'none');
  const tokenBody = new URLSearchParams(mock.calls[1].body);
  assert.equal(tokenBody.get('grant_type'), 'authorization_code');
  assert.equal(tokenBody.get('code'), 'mock-code');
  assert.ok(tokenBody.get('code_verifier'));
  assert.equal(await auth.refreshAccessToken(), 'mock-access');
  assert.equal(mock.calls.at(-1).url, 'https://api.alphaxiv.org/auth/oauth2/token');
  assert.equal(new URLSearchParams(mock.calls.at(-1).body).get('grant_type'), 'refresh_token');
  assert.ok(mock.files.has('/mock-home/.ahub/auth.json'));
});

for (const state of ['wrong', 'missing']) {
  test(`OAuth ${state} callback state fails before token exchange or auth writes`, async () => {
    const mock = mockAuth({ state });
    const auth = await loadSource('../../cli/src/lib/auth.js', mock);
    await assert.rejects(auth.login(), /OAuth state mismatch/);
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.files.size, 0);
    assert.equal(mock.callbackStatus(), 400);
  });
}

async function mockSearch(payload = modern, failure = null) {
  const calls = [];
  class Client {
    async connect() {}
    async close() {}
    async callTool(request) {
      calls.push(plain(request));
      if (failure) throw new Error(failure);
      return { content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] };
    }
  }
  const stubs = {
    '@modelcontextprotocol/sdk/client/index.js': { Client },
    '@modelcontextprotocol/sdk/client/streamableHttp.js': { StreamableHTTPClientTransport: class {} },
    [new URL('../cli/src/lib/auth.js', import.meta.url).href]: {
      getValidToken: async () => 'mock-access', refreshAccessToken: async () => null,
      getUserName: () => null, isLoggedIn: () => true, login() {}, logout() {},
    },
  };
  const lib = await loadSource('../../cli/src/lib/index.js', { stubs });
  const raw = await loadSource('../../cli/src/lib/alphaxiv.js', { stubs });
  return { lib, raw, calls, stubs };
}

test('search wrappers call discover_papers with array keywords/numeric difficulty, never removed tools', async () => {
  const { raw, calls } = await mockSearch();
  await raw.searchByEmbedding('  graph   networks ');
  await raw.searchByKeyword('graph networks');
  await raw.agenticSearch('graph networks');
  assert.deepEqual(calls.map((call) => call.name), Array(3).fill('discover_papers'));
  assert.deepEqual(calls.map((call) => call.arguments), [1, 1, 3].map((difficulty, index) => ({
    keywords: ['graph', 'networks'], question: index === 0 ? 'graph   networks' : 'graph networks', difficulty,
  })));
  await assert.rejects(raw.searchByEmbedding(' \t '), /must not be empty/);
  assert.equal(calls.length, 3);
});

test('search all and both retain compatibility keys and deduplicate broad requests', async () => {
  const { lib, raw, calls } = await mockSearch();
  assert.deepEqual(Object.keys(await raw.searchAll('graph')), ['semantic', 'keyword', 'agentic']);
  assert.equal(calls.length, 2);
  const both = await lib.searchPapers('graph', 'both');
  assert.deepEqual(Object.keys(both), ['query', 'mode', 'semantic', 'keyword']);
  assert.equal(calls.length, 3);
  const all = await lib.searchPapers('graph', 'all');
  assert.deepEqual(Object.keys(all), ['query', 'mode', 'semantic', 'keyword', 'agentic']);
  assert.equal(calls.length, 5);
  for (const key of ['semantic', 'keyword', 'agentic']) {
    assert.equal(all[key].results[0].arxivId, '1706.03762');
  }
});

test('modern, legacy and structured paper results preserve the library result fields', async () => {
  const { lib } = await mockSearch();
  const legacy = '1. **Legacy Paper** (42 Visits, 7 Likes, Published on 2017-06-12)\n- arXiv Id: 1706.03762\n- Authors: Example Author\n- Abstract: Legacy abstract.';
  const entry = { link: '/abs/1706.03762', title: 'Structured Paper', snippet: 'Structured abstract.' };
  const payloads = [modern, legacy, [entry], { results: [entry] }, { papers: [entry] }, { data: [entry] }];
  for (const payload of payloads) {
    const parsed = lib.parsePaperSearchResults(payload, { includeRaw: true });
    const result = parsed.results[0];
    assert.equal(result.arxivId, '1706.03762');
    assert.equal(result.arxivUrl, 'https://arxiv.org/abs/1706.03762');
    assert.equal(result.alphaXivUrl, 'https://www.alphaxiv.org/overview/1706.03762');
    for (const field of ['rank', 'title', 'visits', 'likes', 'publishedAt', 'organizations', 'authors', 'abstract', 'raw']) {
      assert.ok(Object.hasOwn(result, field), field);
    }
    assert.ok(parsed.raw);
  }
  const multiple = lib.parsePaperSearchResults(modern + '\n2. [ID=2401.00001] **Wrapped\nTitle**. Published 2024-01-01: Second\nabstract.');
  assert.equal(multiple.results.length, 2);
  assert.equal(multiple.results[1].title, 'Wrapped Title');
  assert.equal(multiple.results[1].abstract, 'Second abstract.');
  assert.equal(lib.parsePaperSearchResults(legacy).results[0].visits, 42);
  assert.deepEqual(plain(lib.parsePaperSearchResults(null)), { results: [] });
  const structured = await mockSearch([entry]);
  assert.equal((await structured.lib.searchPapers('graph')).results[0].title, 'Structured Paper');
});

test('discovery source URLs and vote/view metrics preserve normalized paper fields', async () => {
  const fixture = readFileSync(new URL('./fixtures/discover-paper-formats.txt', import.meta.url), 'utf8').trim();
  const { lib } = await mockSearch(fixture);
  const parsed = await lib.searchPapers('synthetic papers', 'semantic', { includeRaw: true });
  assert.equal(parsed.results.length, 4);
  assert.equal(parsed.raw, fixture);
  const expected = [
    ['2401.00001', 'Synthetic Grouped Paper', '2024-01-01', 'Example University, Example Lab', 1118, 181172, 'Synthetic grouped abstract.'],
    ['2606.00002', 'Synthetic Paper: No Groups', '2026-06-01', null, 13, 110, 'Synthetic abstract without organizations.'],
    ['2401.00003', 'Synthetic Prior Format', '2024-01-03', 'Example Lab', null, null, 'Synthetic prior-format abstract.'],
    ['2401.00004', 'Synthetic Wrapped Title', '2024-01-04', 'Example Lab', 0, 1234, 'Synthetic wrapped abstract.'],
  ];
  expected.forEach(([id, title, date, organizations, likes, visits, abstract], index) => {
    const result = parsed.results[index];
    assert.deepEqual(plain(result), {
      rank: index + 1, arxivId: id, title, publishedAt: date, organizations,
      authors: null, likes, visits, abstract,
      arxivUrl: `https://arxiv.org/abs/${id}`, alphaXivUrl: `https://www.alphaxiv.org/overview/${id}`,
      raw: result.raw,
    });
    assert.match(result.raw, /^\d+\. \[ID=/);
    assert.doesNotMatch(result.organizations || '', /votes|views/);
  });
  for (const metadata of ['', ' · 5 votes', ' · 9 views', ' · 5 votes · 9 views']) {
    const result = lib.parsePaperSearchResults(
      `1. [ID=2401.00005] **Synthetic Optional Fields**. Published 2024-01-05${metadata}: Synthetic abstract.`,
    ).results[0];
    assert.equal(result.organizations, null);
    assert.equal(result.likes, metadata.includes('votes') ? 5 : null);
    assert.equal(result.visits, metadata.includes('views') ? 9 : null);
    assert.equal(result.abstract, 'Synthetic abstract.');
  }
});

test('paper Q&A uses paper/queries and preserves returned XML sections, not a generated answer', async () => {
  const xml = '<paper id="1706.03762"><page num="4">Synthetic optimizer evidence.</page></paper>';
  const { raw, lib, calls } = await mockSearch(xml);
  assert.equal(await raw.answerPdfQuery('https://arxiv.org/abs/1706.03762', 'Which optimizer?'), xml);
  assert.deepEqual(calls[0], {
    name: 'answer_pdf_queries',
    arguments: { paper: 'https://arxiv.org/abs/1706.03762', queries: ['Which optimizer?'] },
  });
  assert.equal((await lib.askPaper('1706.03762', 'Which optimizer?')).answer, xml);
  const failing = await mockSearch(modern, 'Permission denied');
  await assert.rejects(failing.raw.searchByKeyword('graph'), /Permission denied/);
  assert.equal(failing.calls.length, 1);
});

test('existing CLI and MCP search entrypoints execute the adapter without changing JSON shapes', async () => {
  const { stubs, calls } = await mockSearch();
  const printed = [];
  const command = await loadSource('../../cli/src/commands/search.js', {
    stubs: { ...stubs, chalk: { default: { dim: (value) => value } } },
    globals: { console: { log: (value) => printed.push(value) } },
  });
  let action;
  const program = {
    command() { return this; }, description() { return this; }, option() { return this; },
    opts: () => ({ json: true }), action(fn) { action = fn; },
  };
  command.registerSearchCommand(program);
  for (const mode of ['semantic', 'keyword', 'agentic', 'both', 'all']) {
    await action('graph networks', { mode });
    const result = JSON.parse(printed.at(-1));
    if (mode === 'both') assert.deepEqual(Object.keys(result), ['semantic', 'keyword']);
    else if (mode === 'all') assert.deepEqual(Object.keys(result), ['semantic', 'keyword', 'agentic']);
    else assert.equal(result, modern);
  }
  const mcp = await loadSource('../../cli/src/mcp/tools.js', { stubs });
  for (const mode of ['semantic', 'keyword', 'agentic']) {
    const result = await mcp.handleSearch({ query: 'graph networks', mode });
    assert.equal(result.isError, undefined);
    assert.equal(result.content[0].text, modern);
  }
  assert.ok(calls.length > 0);
  assert.ok(calls.every((call) => call.name === 'discover_papers'));
});
