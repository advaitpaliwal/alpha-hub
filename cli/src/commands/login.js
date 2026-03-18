import chalk from 'chalk';
import { login, isLoggedIn, logout } from '../lib/auth.js';

export function registerLoginCommand(program) {
  program
    .command('login')
    .description('Log in to alphaXiv (opens browser)')
    .action(async () => {
      try {
        if (isLoggedIn()) {
          process.stderr.write(chalk.dim('Already logged in. Use `alpha logout` to sign out first.\n'));
        }
        const { userInfo } = await login();
        const name = userInfo?.name || userInfo?.email || 'unknown';
        console.log(chalk.green(`Logged in to alphaXiv as ${name}`));
      } catch (err) {
        process.stderr.write(`${chalk.red('Login failed:')} ${err.message}\n`);
        process.exit(1);
      }
    });
}

export function registerLogoutCommand(program) {
  program
    .command('logout')
    .description('Log out of alphaXiv')
    .action(() => {
      logout();
      console.log(chalk.green('Logged out'));
    });
}
