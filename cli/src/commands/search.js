import chalk from 'chalk';
import { searchPapers, disconnect } from '../lib/index.js';
import { output, error, info } from '../lib/output.js';

function formatResultBlock({ results }) {
  if (!results?.length) {
    console.log(chalk.dim('No results.'));
    return;
  }
  results.forEach(r => {
    const prefix = r.rank ? `${r.rank}. ` : '';
    console.log(chalk.bold(`${prefix}${r.title || '(untitled)'}`) +
      (r.arxivId ? chalk.dim(` [${r.arxivId}]`) : ''));
    if (r.publishedAt) console.log(chalk.dim(`   Published: ${r.publishedAt}`) +
      (r.organizations ? chalk.dim(` — ${r.organizations}`) : ''));
    if (r.arxivUrl) console.log(chalk.dim(`   ${r.arxivUrl}`));
    if (r.abstract) {
      const snippet = r.abstract.length > 280 ? r.abstract.slice(0, 280) + '…' : r.abstract;
      console.log(`   ${snippet}`);
    }
    console.log();
  });
}

function formatResults(data) {
  if (data.results) {
    formatResultBlock(data);
    return;
  }
  // multi-mode (both / all): data has semantic / keyword / agentic sub-objects
  for (const [key, val] of Object.entries(data)) {
    if (key === 'query' || key === 'mode') continue;
    if (val?.results) {
      console.log(chalk.underline(`\n${key}:`));
      formatResultBlock(val);
    }
  }
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
        const results = await searchPapers(query, opts.mode);
        output(results, formatResults, opts);
      } catch (err) {
        error(err.message, opts);
      } finally {
        await disconnect();
      }
    });
}
