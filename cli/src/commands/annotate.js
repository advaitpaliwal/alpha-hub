import chalk from 'chalk';
import { writeAnnotation, readAnnotation, clearAnnotation, listAnnotations } from '../lib/annotations.js';
import { normalizePaperId } from '../lib/papers.js';
import { output, error } from '../lib/output.js';

function formatList(annotations) {
  if (annotations.length === 0) {
    console.log(chalk.dim('No annotations.'));
    return;
  }
  annotations.forEach(a => {
    console.log(`${chalk.bold(a.id)} ${chalk.dim(`(${a.updatedAt})`)}`);
    console.log(`  ${a.note}`);
    console.log();
  });
}

export function registerAnnotateCommand(program) {
  program
    .command('annotate [paper-id] [note]')
    .description('Read, write, or list local annotations')
    .option('--clear', 'Remove annotation for this paper')
    .option('--list', 'List all annotations')
    .action(async (paperId, note, cmdOpts) => {
      const opts = { ...program.opts(), ...cmdOpts };

      if (opts.list) {
        const all = listAnnotations();
        output(all, formatList, opts);
        return;
      }

      if (!paperId) {
        error('Provide a paper ID, or use --list', opts);
      }

      const id = normalizePaperId(paperId);

      if (opts.clear) {
        const removed = clearAnnotation(id);
        if (removed) {
          console.log(chalk.green(`Cleared annotation for ${id}`));
        } else {
          console.log(chalk.dim(`No annotation for ${id}`));
        }
        return;
      }

      if (note) {
        const saved = writeAnnotation(id, note);
        output(saved, () => console.log(chalk.green(`Annotation saved for ${id}`)), opts);
        return;
      }

      const existing = readAnnotation(id);
      if (existing) {
        output(existing, () => {
          console.log(`${chalk.bold(existing.id)} ${chalk.dim(`(${existing.updatedAt})`)}`);
          console.log(`  ${existing.note}`);
        }, opts);
      } else {
        console.log(chalk.dim(`No annotation for ${id}`));
      }
    });
}
