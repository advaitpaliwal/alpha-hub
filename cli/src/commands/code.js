import { readGithubRepo, disconnect } from '../lib/alphaxiv.js';
import { output, error } from '../lib/output.js';

function formatResult(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  console.log(text);
}

export function registerCodeCommand(program) {
  program
    .command('code <github-url> [path]')
    .description("Read files from a paper's GitHub repository")
    .action(async (githubUrl, path, cmdOpts) => {
      const opts = { ...program.opts(), ...cmdOpts };
      try {
        const result = await readGithubRepo(githubUrl, path || '/');
        output(result, formatResult, opts);
      } catch (err) {
        error(err.message, opts);
      } finally {
        await disconnect();
      }
    });
}
