export function normalizePaperId(input) {
  const patterns = [
    /arxiv\.org\/abs\/(\d+\.\d+)/,
    /arxiv\.org\/pdf\/(\d+\.\d+)/,
    /alphaxiv\.org\/(?:abs|overview)\/(\d+\.\d+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  if (/^\d+\.\d+$/.test(input)) return input;

  return input;
}

export function toArxivUrl(input) {
  const id = normalizePaperId(input);
  if (/^\d+\.\d+$/.test(id)) {
    return `https://arxiv.org/abs/${id}`;
  }
  if (input.startsWith('http')) return input;
  return `https://arxiv.org/abs/${input}`;
}
