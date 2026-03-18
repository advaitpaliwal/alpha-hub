import { readFileSync, writeFileSync, unlinkSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

function getAnnotationsDir() {
  const dir = join(homedir(), '.ahub', 'annotations');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function safeFilename(id) {
  return id.replace(/\//g, '--') + '.json';
}

export function writeAnnotation(id, note) {
  const filePath = join(getAnnotationsDir(), safeFilename(id));
  const data = {
    id,
    note,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

export function readAnnotation(id) {
  try {
    const filePath = join(getAnnotationsDir(), safeFilename(id));
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function clearAnnotation(id) {
  try {
    const filePath = join(getAnnotationsDir(), safeFilename(id));
    unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function listAnnotations() {
  const dir = getAnnotationsDir();
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  const annotations = [];
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (data.id && data.note) annotations.push(data);
    } catch {
    }
  }
  return annotations;
}
