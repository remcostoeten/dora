import chalk from 'chalk';
import ora from 'ora';

const logger = {
  info: (message: string) => console.log(chalk.blue('ℹ'), message),
  success: (message: string) => console.log(chalk.green('✓'), message),
  warning: (message: string) => console.log(chalk.yellow('⚠'), message),
  error: (message: string) => console.log(chalk.red('✗'), message),
  table: (data: string[][]) => {
    console.log(data.map(row => row.join(' ')).join('\n'));
  },
  spinner: ora()
};

export default logger;