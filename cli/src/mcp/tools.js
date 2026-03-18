import {
  searchByEmbedding,
  searchByKeyword,
  agenticSearch,
  getPaperContent,
  answerPdfQuery,
  readGithubRepo,
} from '../lib/alphaxiv.js';
import { writeAnnotation, readAnnotation, clearAnnotation, listAnnotations } from '../lib/annotations.js';
import { normalizePaperId, toArxivUrl } from '../lib/papers.js';

function textResult(data) {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

export async function handleSearch({ query, mode = 'semantic' }) {
  try {
    if (mode === 'keyword') return textResult(await searchByKeyword(query));
    if (mode === 'agentic') return textResult(await agenticSearch(query));
    return textResult(await searchByEmbedding(query));
  } catch (err) {
    return errorResult(`Search failed: ${err.message}`);
  }
}

export async function handleGet({ url, full_text = false }) {
  try {
    const paperId = normalizePaperId(url);
    const arxivUrl = toArxivUrl(url);

    const content = await getPaperContent(arxivUrl, { fullText: full_text });
    const annotation = readAnnotation(paperId);

    return textResult({ content, annotation });
  } catch (err) {
    return errorResult(`Failed to fetch paper: ${err.message}`);
  }
}

export async function handleAsk({ url, question }) {
  try {
    const answer = await answerPdfQuery(toArxivUrl(url), question);
    return textResult(answer);
  } catch (err) {
    return errorResult(`Ask failed: ${err.message}`);
  }
}

export async function handleAnnotate({ id, note, clear = false, list = false }) {
  try {
    if (list) {
      const all = listAnnotations();
      return textResult({ annotations: all, total: all.length });
    }

    if (!id) return errorResult('Provide a paper ID or use list mode.');

    const paperId = normalizePaperId(id);

    if (clear) {
      const removed = clearAnnotation(paperId);
      return textResult({ status: removed ? 'cleared' : 'not_found', id: paperId });
    }

    if (note) {
      const saved = writeAnnotation(paperId, note);
      return textResult({ status: 'saved', annotation: saved });
    }

    const existing = readAnnotation(paperId);
    if (existing) return textResult({ annotation: existing });
    return textResult({ status: 'no_annotation', id: paperId });
  } catch (err) {
    return errorResult(`Annotation failed: ${err.message}`);
  }
}

export async function handleCode({ github_url, path = '/' }) {
  try {
    const result = await readGithubRepo(github_url, path);
    return textResult(result);
  } catch (err) {
    return errorResult(`Code read failed: ${err.message}`);
  }
}
