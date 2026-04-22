import chalk from 'chalk';
import { getLoginState, getUserName, login, logout } from '../lib/auth.js';

export function registerLoginCommand(program) {
  program
    .command('login')
    .description('Log in to alphaXiv (opens browser)')
    .action(async () => {
      try {
        const loginState = await getLoginState();
        if (loginState === 'valid') {
          process.stderr.write(chalk.dim('Already logged in. Use `alpha logout` to sign out first.\n'));
        } else if (loginState === 'expired' || loginState === 'invalid') {
          process.stderr.write(chalk.dim('Saved alphaXiv session is expired or invalid. Continuing with a fresh login.\n'));
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

export function registerStatusCommand(program) {
  program
    .command('status')
    .description('Show alphaXiv authentication status')
    .action(async () => {
      const loginState = await getLoginState();
      if (loginState === 'missing') {
        process.stderr.write(chalk.dim('Not logged in to alphaXiv.\n'));
        process.exitCode = 1;
        return;
      }

      if (loginState === 'expired') {
        process.stderr.write(chalk.yellow('Saved alphaXiv session has expired. Run `alpha logout` and `alpha login`.\n'));
        process.exitCode = 1;
        return;
      }

      if (loginState === 'invalid') {
        process.stderr.write(chalk.yellow('Saved alphaXiv session is invalid. Run `alpha logout` and `alpha login`.\n'));
        process.exitCode = 1;
        return;
      }

      const name = getUserName();
      console.log(chalk.green(name ? `Logged in to alphaXiv as ${name}` : 'Logged in to alphaXiv'));
    });
}
