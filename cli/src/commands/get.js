import chalk from 'chalk';
import { getPaperContent, disconnect } from '../lib/alphaxiv.js';
import { readAnnotation } from '../lib/annotations.js';
import { output, error } from '../lib/output.js';
import { normalizePaperId, toArxivUrl } from '../lib/papers.js';

function formatPaper({ content, annotation }) {
  console.log(typeof content === 'string' ? content : JSON.stringify(content, null, 2));

  if (annotation) {
    console.log();
    console.log(chalk.dim('---'));
    console.log(chalk.dim(`[Note — ${annotation.updatedAt}]`));
    console.log(annotation.note);
  }
}

export function registerGetCommand(program) {
  program
    .command('get <url>')
    .description('Get paper content + local annotation (arXiv/alphaXiv URL or ID)')
    .option('--full-text', 'Get raw extracted text instead of AI report')
    .action(async (url, cmdOpts) => {
      const opts = { ...program.opts(), ...cmdOpts };
      try {
        const paperId = normalizePaperId(url);
        const arxivUrl = toArxivUrl(url);

        const content = await getPaperContent(arxivUrl, { fullText: !!opts.fullText });
        const annotation = readAnnotation(paperId);

        output({ content, annotation }, formatPaper, opts);
      } catch (err) {
        error(err.message, opts);
      } finally {
        await disconnect();
      }
    });
}
