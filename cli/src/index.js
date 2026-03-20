import chalk from 'chalk';
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerSearchCommand } from './commands/search.js';
import { registerGetCommand } from './commands/get.js';
import { registerAskCommand } from './commands/ask.js';
import { registerAnnotateCommand } from './commands/annotate.js';
import { registerCodeCommand } from './commands/code.js';
import { registerLoginCommand, registerLogoutCommand } from './commands/login.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

function printUsage() {
  console.log(`
${chalk.bold('alpha')} — Alpha Hub CLI v${pkg.version}
Search papers and annotate what you learn. Powered by alphaXiv.

${chalk.bold.underline('Usage')}

  ${chalk.dim('$')} alpha search "transformer attention mechanisms"     ${chalk.dim('# semantic search')}
  ${chalk.dim('$')} alpha search "LoRA" --mode keyword                 ${chalk.dim('# keyword search')}
  ${chalk.dim('$')} alpha search "hallucination in LLMs" --mode agentic ${chalk.dim('# agentic retrieval')}
  ${chalk.dim('$')} alpha search "RAG for QA" --mode all               ${chalk.dim('# semantic + keyword + agentic')}
  ${chalk.dim('$')} alpha get 1706.03762                               ${chalk.dim('# paper content + annotation')}
  ${chalk.dim('$')} alpha get https://arxiv.org/abs/2106.09685         ${chalk.dim('# by URL')}
  ${chalk.dim('$')} alpha ask 1706.03762 "How does attention work?"    ${chalk.dim('# ask about a paper')}
  ${chalk.dim('$')} alpha code https://github.com/openai/gpt-2 /       ${chalk.dim('# inspect repo structure')}
  ${chalk.dim('$')} alpha annotate 1706.03762 "key insight"            ${chalk.dim('# save a note')}
  ${chalk.dim('$')} alpha annotate --list                              ${chalk.dim('# see all notes')}

${chalk.bold.underline('Commands')}

  ${chalk.bold('login')}                            Log in to alphaXiv (opens browser)
  ${chalk.bold('logout')}                           Log out
  ${chalk.bold('search')} <query>                    Search papers (semantic, keyword, both, agentic, or all)
  ${chalk.bold('get')} <url|arxiv-id>                Paper content + local annotation
  ${chalk.bold('ask')} <url|arxiv-id> <question>      Ask a question about a paper
  ${chalk.bold('code')} <github-url> [path]          Read files from a paper repository
  ${chalk.bold('annotate')} [paper-id] [note]        Save a note — appears on future fetches
  ${chalk.bold('annotate')} <paper-id> --clear        Remove a note
  ${chalk.bold('annotate')} --list                    List all notes

${chalk.bold.underline('Flags')}

  --json                 JSON output (for agents and piping)
  -m, --mode <mode>      Search mode: semantic, keyword, both, agentic, all (default: semantic)
  --full-text            Get raw text instead of AI report (for get)
`);
}

const program = new Command();

program
  .name('alpha')
  .description('Alpha Hub - search papers and annotate what you learn')
  .version(pkg.version, '-V, --cli-version')
  .option('--json', 'Output as JSON (machine-readable)')
  .action(() => {
    printUsage();
  });

registerLoginCommand(program);
registerLogoutCommand(program);
registerSearchCommand(program);
registerGetCommand(program);
registerAskCommand(program);
registerCodeCommand(program);
registerAnnotateCommand(program);

program.parse();
