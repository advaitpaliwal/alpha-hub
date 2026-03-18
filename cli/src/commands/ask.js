import { answerPdfQuery, disconnect } from '../lib/alphaxiv.js';
import { output, error } from '../lib/output.js';
import { toArxivUrl } from '../lib/papers.js';

function formatAnswer(data) {
  console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

export function registerAskCommand(program) {
  program
    .command('ask <url> <question>')
    .description('Ask a question about a paper (arXiv/alphaXiv URL or ID)')
    .action(async (url, question, cmdOpts) => {
      const opts = { ...program.opts(), ...cmdOpts };
      try {
        const answer = await answerPdfQuery(toArxivUrl(url), question);
        output(answer, formatAnswer, opts);
      } catch (err) {
        error(err.message, opts);
      } finally {
        await disconnect();
      }
    });
}
