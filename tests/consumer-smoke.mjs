// Run from cli/ or a clean consumer containing the installed tarball.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const home = mkdtempSync(resolve(tmpdir(), 'alpha-hub-smoke-home-'));
const originalHome = process.env.HOME;
process.env.HOME = home;
globalThis.fetch = () => { throw new Error('Network forbidden in consumer smoke'); };
const require = createRequire(resolve('package.json'));
const packageName = '@advaitpaliwal/alpha-hub';
const entry = require.resolve(packageName);
const root = resolve(dirname(entry), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json')));
const load = (specifier) => import(pathToFileURL(require.resolve(specifier)));

try {
  assert.equal(manifest.name, packageName);
  assert.equal(manifest.version, '0.1.4');
  for (const subpath of Object.keys(manifest.exports)) {
    const specifier = subpath === '.' ? packageName : packageName + subpath.slice(1);
    assert.ok(require.resolve(specifier));
    if (subpath !== '.') await load(specifier);
  }
  const help = execFileSync(process.execPath, [resolve(root, 'bin/alpha'), '--help'], {
    encoding: 'utf8', timeout: 10_000,
  });
  assert.match(help, /search/);
  const version = execFileSync(process.execPath, [resolve(root, 'bin/alpha'), '--cli-version'], {
    encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(version.trim(), '0.1.4');

  const lib = await load(`${packageName}/lib`);
  const auth = await load(`${packageName}/lib/auth`);
  assert.equal(auth.isLoggedIn(), false);
  assert.equal(lib.normalizePaperId('https://arxiv.org/abs/1706.03762'), '1706.03762');
  const parsed = lib.parsePaperSearchResults(
    '1. **Attention Is All You Need** (42 Visits, 7 Likes, Published on 2017-06-12)\n' +
    '- arXiv Id: 1706.03762\n- Authors: Example Author\n- Abstract: Mock paper text.',
  );
  assert.equal(parsed.results[0].arxivId, '1706.03762');
  assert.equal(parsed.results[0].visits, 42);
  await lib.annotatePaper('1706.03762', 'Offline migration smoke');
  assert.equal((await lib.getPaperAnnotation('1706.03762')).annotation.note, 'Offline migration smoke');
  assert.equal((await lib.listPaperAnnotations()).total, 1);
  assert.equal((await lib.clearPaperAnnotation('1706.03762')).status, 'cleared');

  const packageRequire = createRequire(resolve(root, 'package.json'));
  const { Client } = await import(pathToFileURL(packageRequire.resolve('@modelcontextprotocol/sdk/client/index.js')));
  const { StdioClientTransport } = await import(pathToFileURL(packageRequire.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
  const client = new Client({ name: 'migration-smoke', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(root, 'bin/alpha-mcp')],
    env: { HOME: home, PATH: process.env.PATH },
    stderr: 'pipe',
  });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().version, '0.1.4');
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(),
      ['alpha_annotate', 'alpha_ask', 'alpha_code', 'alpha_get', 'alpha_search']);
    const result = await client.callTool({ name: 'alpha_annotate', arguments: { list: true } });
    assert.equal(JSON.parse(result.content[0].text).total, 0);
  } finally {
    await client.close();
  }
  console.log('PASS: personal package exports, CLI help/version, mock paper parsing, isolated annotations, MCP handshake/tools/local call');
} finally {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  rmSync(home, { recursive: true, force: true });
}
