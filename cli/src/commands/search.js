import chalk from 'chalk';
import {
  searchByEmbedding,
  searchByKeyword,
  agenticSearch,
  searchAll,
  disconnect,
} from '../lib/alphaxiv.js';
import { output, error, info } from '../lib/output.js';

function formatResults(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  console.log(text);
}

function describeMode(mode) {
  switch (mode) {
    case 'keyword':
      return 'keyword full-text';
    case 'agentic':
      return 'agentic';
    case 'both':
      return 'semantic + keyword';
    case 'all':
      return 'semantic + keyword + agentic';
    default:
      return 'semantic';
  }
}

export function registerSearchCommand(program) {
  program
    .command('search <query>')
    .description('Search papers via alphaXiv (semantic, keyword, both, agentic, or all)')
    .option('-m, --mode <mode>', 'Search mode: semantic, keyword, both, agentic, all', 'semantic')
    .action(async (query, cmdOpts) => {
      const opts = { ...program.opts(), ...cmdOpts };
      try {
        if (!opts.json) {
          info(chalk.dim(`Searching alphaXiv (${describeMode(opts.mode)})...`));
        }
        let results;
        if (opts.mode === 'keyword') {
          results = await searchByKeyword(query);
        } else if (opts.mode === 'agentic') {
          results = await agenticSearch(query);
        } else if (opts.mode === 'both') {
          // alphaXiv merged semantic and keyword search into a single
          // `discover_papers` tool, so we issue one request and surface it
          // under both keys to keep the existing CLI output shape.
          const result = await searchByEmbedding(query);
          results = { semantic: result, keyword: result };
        } else if (opts.mode === 'all') {
          results = await searchAll(query);
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
