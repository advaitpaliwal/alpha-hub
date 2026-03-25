import {
  agenticSearch,
  answerPdfQuery,
  disconnect,
  getPaperContent,
  readGithubRepo,
  searchAll,
  searchByEmbedding,
  searchByKeyword,
} from './alphaxiv.js';
import {
  clearAnnotation,
  listAnnotations,
  readAnnotation,
  writeAnnotation,
} from './annotations.js';
import { getUserName, isLoggedIn, login, logout } from './auth.js';
import { normalizePaperId, toArxivUrl } from './papers.js';

export {
  disconnect,
  getUserName,
  isLoggedIn,
  login,
  logout,
  normalizePaperId,
  searchAll,
  searchByEmbedding,
  searchByKeyword,
  agenticSearch,
  readAnnotation,
  writeAnnotation,
  clearAnnotation,
  listAnnotations,
  readGithubRepo,
};

function parseMetricNumber(fragment, label) {
  const match = fragment.match(new RegExp(`(\\d+)\\s+${label}`, 'i'));
  return match ? Number(match[1]) : null;
}

function parsePublishedAt(fragment) {
  const match = fragment.match(/Published on ([^,]+)(?:,|$)/i);
  return match ? match[1].trim() : null;
}

function cleanSearchField(value) {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return normalized || null;
}

export function parsePaperSearchResults(text, options = {}) {
  const includeRaw = options.includeRaw === true;
  if (typeof text !== 'string') {
    return { results: [] };
  }

  const blocks = text
    .split(/\n(?=\d+\.\s+\*\*)/g)
    .map((block) => block.trim())
    .filter(Boolean);

  const results = blocks.map((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const header = lines[0] || '';
    const headerMatch = header.match(/^\d+\.\s+\*\*(.+?)\*\*\s+\((.+)\)$/);

    const fieldValue = (prefix) => {
      const line = lines.find((entry) => entry.startsWith(prefix));
      return line ? line.slice(prefix.length).trim() : null;
    };

    const arxivId = fieldValue('- arXiv Id:');

    return {
      rank: index + 1,
      title: cleanSearchField(headerMatch ? headerMatch[1] : header),
      visits: headerMatch ? parseMetricNumber(headerMatch[2], 'Visits') : null,
      likes: headerMatch ? parseMetricNumber(headerMatch[2], 'Likes') : null,
      publishedAt: headerMatch ? parsePublishedAt(headerMatch[2]) : null,
      organizations: cleanSearchField(fieldValue('- Organizations:')),
      authors: cleanSearchField(fieldValue('- Authors:')),
      abstract: cleanSearchField(fieldValue('- Abstract:')),
      arxivId: cleanSearchField(arxivId),
      arxivUrl: arxivId ? `https://arxiv.org/abs/${arxivId}` : null,
      alphaXivUrl: arxivId ? `https://www.alphaxiv.org/overview/${arxivId}` : null,
      ...(includeRaw ? { raw: block } : {}),
    };
  });

  return includeRaw ? { raw: text, results } : { results };
}

function normalizeSearchPayload(query, mode, payload, options = {}) {
  if (mode === 'all' || mode === 'both') {
    const normalized = {};
    for (const [key, value] of Object.entries(payload)) {
      normalized[key] = parsePaperSearchResults(value, options);
    }
    return {
      query,
      mode,
      ...normalized,
    };
  }

  const parsed = parsePaperSearchResults(payload, options);
  return {
    query,
    mode,
    ...parsed,
  };
}

export async function searchPapers(query, mode = 'semantic', options = {}) {
  if (mode === 'keyword') return normalizeSearchPayload(query, mode, await searchByKeyword(query), options);
  if (mode === 'agentic') return normalizeSearchPayload(query, mode, await agenticSearch(query), options);
  if (mode === 'both') {
    const [semantic, keyword] = await Promise.all([
      searchByEmbedding(query),
      searchByKeyword(query),
    ]);
    return normalizeSearchPayload(query, mode, { semantic, keyword }, options);
  }
  if (mode === 'all') return normalizeSearchPayload(query, mode, await searchAll(query), options);
  return normalizeSearchPayload(query, mode, await searchByEmbedding(query), options);
}

export async function getPaper(identifier, options = {}) {
  const paperId = normalizePaperId(identifier);
  const url = toArxivUrl(identifier);
  const content = await getPaperContent(url, { fullText: Boolean(options.fullText) });
  const annotation = readAnnotation(paperId);
  return {
    paperId,
    url,
    alphaXivUrl: `https://www.alphaxiv.org/overview/${paperId}`,
    content,
    annotation,
  };
}

export async function askPaper(identifier, question) {
  const paperId = normalizePaperId(identifier);
  const url = toArxivUrl(identifier);
  const answer = await answerPdfQuery(url, question);
  return {
    paperId,
    url,
    alphaXivUrl: `https://www.alphaxiv.org/overview/${paperId}`,
    question,
    answer,
  };
}

export async function annotatePaper(identifier, note) {
  const paperId = normalizePaperId(identifier);
  const annotation = writeAnnotation(paperId, note);
  return { status: 'saved', annotation };
}

export async function clearPaperAnnotation(identifier) {
  const paperId = normalizePaperId(identifier);
  const cleared = clearAnnotation(paperId);
  return { status: cleared ? 'cleared' : 'not_found', paperId };
}

export async function getPaperAnnotation(identifier) {
  const paperId = normalizePaperId(identifier);
  const annotation = readAnnotation(paperId);
  return annotation ? { status: 'found', annotation } : { status: 'no_annotation', paperId };
}

export async function listPaperAnnotations() {
  const annotations = listAnnotations();
  return { total: annotations.length, annotations };
}

export async function readPaperCode(githubUrl, path = '/') {
  return readGithubRepo(githubUrl, path);
}
