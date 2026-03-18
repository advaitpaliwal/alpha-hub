import chalk from 'chalk';
import { searchByEmbedding, searchByKeyword, disconnect } from '../lib/alphaxiv.js';
import { output, error } from '../lib/output.js';

function formatResults(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  console.log(text);
}

export function registerSearchCommand(program) {
  program
    .command('search <query>')
    .description('Search papers via alphaXiv (semantic + keyword)')
    .option('-m, --mode <mode>', 'Search mode: semantic, keyword, both', 'semantic')
    .action(async (query, cmdOpts) => {
      const opts = { ...program.opts(), ...cmdOpts };
      try {
        let results;
        if (opts.mode === 'keyword') {
          results = await searchByKeyword(query);
        } else if (opts.mode === 'both') {
          const [semantic, keyword] = await Promise.all([
            searchByEmbedding(query),
            searchByKeyword(query),
          ]);
          results = { semantic, keyword };
        } else {
          results = await searchByEmbedding(query);
        }
        output(results, formatResults, opts);
      } catch (err) {
        error(err.message, opts);
      } finally {
        await disconnect();
      }
    });
}
