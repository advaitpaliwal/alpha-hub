import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getValidToken, refreshAccessToken } from './auth.js';

const ALPHAXIV_MCP_URL = 'https://api.alphaxiv.org/mcp/v1';

let _client = null;
let _connected = false;

async function getClient() {
  if (_client && _connected) return _client;

  const token = await getValidToken();
  if (!token) {
    throw new Error('Not logged in. Run `alpha login` first.');
  }

  _client = new Client({ name: 'alpha', version: '0.1.0' });

  _client.onerror = (err) => {
    process.stderr.write(`[alpha] alphaXiv MCP error: ${err.message || err}\n`);
  };

  const transport = new StreamableHTTPClientTransport(new URL(ALPHAXIV_MCP_URL), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  await _client.connect(transport);
  _connected = true;

  return _client;
}

async function callTool(name, args) {
  let client;
  try {
    client = await getClient();
  } catch (err) {
    if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        _client = null;
        _connected = false;
        client = await getClient();
      } else {
        throw new Error('Session expired. Run `alpha login` to re-authenticate.');
      }
    } else {
      throw err;
    }
  }

  const result = await client.callTool({ name, arguments: args });

  if (result.isError) {
    const text = result.content?.[0]?.text || 'Unknown error';
    throw new Error(text);
  }

  const text = result.content?.[0]?.text;
  if (!text) return result.content;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function searchByEmbedding(query) {
  return await callTool('embedding_similarity_search', { query });
}

export async function searchByKeyword(query) {
  return await callTool('full_text_papers_search', { query });
}

export async function agenticSearch(query) {
  return await callTool('agentic_paper_retrieval', { query });
}

export async function searchAll(query) {
  const [semantic, keyword, agentic] = await Promise.all([
    searchByEmbedding(query),
    searchByKeyword(query),
    agenticSearch(query),
  ]);

  return { semantic, keyword, agentic };
}

export async function getPaperContent(url, { fullText = false } = {}) {
  const args = { url };
  if (fullText) args.fullText = true;
  return await callTool('get_paper_content', args);
}

export async function answerPdfQuery(url, query) {
  try {
    return await callTool('answer_pdf_queries', { urls: [url], queries: [query] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Input validation error') || message.includes('Invalid arguments')) {
      return await callTool('answer_pdf_queries', { url, query });
    }
    throw err;
  }
}

export async function readGithubRepo(githubUrl, path = '/') {
  return await callTool('read_files_from_github_repository', { githubUrl, path });
}

export async function disconnect() {
  if (_client) {
    _client.onerror = () => {};
    try {
      await _client.close();
    } catch {
    }
    _client = null;
    _connected = false;
  }
}
