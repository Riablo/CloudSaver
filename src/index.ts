#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { searchCommand } from './commands/search';
import { saveCommand } from './commands/save';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('cloudsaver')
  .description('CloudSaver CLI - 网盘资源搜索与115转存工具')
  .version('1.0.0')
  .usage('<command> [options]')
  .addHelpCommand('help [command]', '显示帮助信息')
  .helpOption('-h, --help', '显示帮助信息');

// 添加命令
searchCommand(program);
saveCommand(program);
configCommand(program);

// 默认显示帮助
if (process.argv.length === 2) {
  console.log(chalk.cyan.bold('\n☁️  CloudSaver CLI\n'));
  console.log(chalk.gray('网盘资源搜索与115转存工具\n'));
  program.help();
}

// 错误处理
program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  if (error.code !== 'commander.help') {
    console.error(chalk.red('错误:'), error.message);
    process.exit(1);
  }
}
