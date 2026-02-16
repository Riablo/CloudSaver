import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from '../config';
import { Cloud115Service } from '../services/Cloud115Service';

export function configCommand(program: Command): void {
  program
    .command('config')
    .description('配置管理')
    .option('--set-cookie', '设置115网盘Cookie')
    .option('--add-channel', '添加搜索频道')
    .option('--remove-channel', '删除搜索频道')
    .option('--set-proxy', '设置代理')
    .option('--show', '显示当前配置')
    .action(async (options) => {
      try {
        const config = ConfigManager.load();

        if (options.setCookie) {
          const { cookie } = await inquirer.prompt([
            {
              type: 'password',
              name: 'cookie',
              message: '请输入115网盘Cookie:',
              mask: '*',
              validate: (input: string) => {
                if (!input.trim()) {
                  return 'Cookie不能为空';
                }
                return true;
              },
            },
          ]);

          // 验证cookie
          console.log(chalk.blue('\n🔍 正在验证Cookie...'));
          const service = new Cloud115Service();
          service.setCookie(cookie);

          try {
            await service.getFolderList('0');
            console.log(chalk.green('✅ Cookie验证成功!'));
          } catch (error: any) {
            console.log(chalk.yellow('⚠️  Cookie验证失败，但已保存'));
            console.log(chalk.gray('  错误: ' + (error.message || error)));
          }
          return;
        }

        if (options.addChannel) {
          const { channelId, channelName } = await inquirer.prompt([
            {
              type: 'input',
              name: 'channelId',
              message: '请输入Telegram频道ID (如: alipan_share):',
              validate: (input: string) => {
                if (!input.trim()) {
                  return '频道ID不能为空';
                }
                return true;
              },
            },
            {
              type: 'input',
              name: 'channelName',
              message: '请输入频道名称 (如: 阿里云盘分享):',
              default: (answers: any) => answers.channelId,
            },
          ]);

          const newChannel = {
            id: channelId.trim(),
            name: channelName.trim() || channelId.trim(),
          };

          const channels = [...config.search.channels, newChannel];
          ConfigManager.save({ search: { ...config.search, channels } });

          console.log(chalk.green(`✅ 已添加频道: ${newChannel.name}`));
          return;
        }

        if (options.removeChannel) {
          if (config.search.channels.length === 0) {
            console.log(chalk.yellow('⚠️  没有配置任何频道'));
            return;
          }

          const { channelToRemove } = await inquirer.prompt([
            {
              type: 'list',
              name: 'channelToRemove',
              message: '选择要删除的频道:',
              choices: config.search.channels.map((c, index) => ({
                name: `${c.name} (${c.id})`,
                value: index,
              })),
            },
          ]);

          const removed = config.search.channels[channelToRemove];
          const channels = config.search.channels.filter((_, i) => i !== channelToRemove);
          ConfigManager.save({ search: { ...config.search, channels } });

          console.log(chalk.green(`✅ 已删除频道: ${removed.name}`));
          return;
        }

        if (options.setProxy) {
          const { enabled, host, port } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'enabled',
              message: '是否启用代理?',
              default: config.search.proxy?.enabled || false,
            },
            {
              type: 'input',
              name: 'host',
              message: '代理主机:',
              default: config.search.proxy?.host || '127.0.0.1',
              when: (answers) => answers.enabled,
            },
            {
              type: 'input',
              name: 'port',
              message: '代理端口:',
              default: config.search.proxy?.port || 7890,
              when: (answers) => answers.enabled,
              validate: (input: string) => {
                const port = parseInt(input, 10);
                if (isNaN(port) || port < 1 || port > 65535) {
                  return '请输入有效的端口号 (1-65535)';
                }
                return true;
              },
            },
          ]);

          ConfigManager.save({
            search: {
              ...config.search,
              proxy: {
                enabled,
                host: host || '127.0.0.1',
                port: parseInt(port, 10) || 7890,
              },
            },
          });

          console.log(chalk.green(`✅ 代理设置已${enabled ? '启用' : '禁用'}`));
          return;
        }

        if (options.show) {
          console.log(chalk.bold('\n📋 当前配置:\n'));
          
          console.log(chalk.bold('搜索配置:'));
          console.log(`  频道数量: ${config.search.channels.length}`);
          config.search.channels.forEach((c, i) => {
            console.log(`    ${i + 1}. ${c.name} (${c.id})`);
          });
          
          console.log(`  代理: ${config.search.proxy?.enabled ? 
            chalk.green(`启用 (${config.search.proxy.host}:${config.search.proxy.port})`) : 
            chalk.gray('禁用')}`);

          console.log(chalk.bold('\n115网盘配置:'));
          const hasCookie = !!config.cloud115.cookie;
          console.log(`  Cookie: ${hasCookie ? chalk.green('已设置') : chalk.red('未设置')}`);
          if (hasCookie) {
            console.log(`  默认文件夹: ${config.cloud115.defaultFolderName || '根目录'}`);
          }
          
          console.log(chalk.gray(`\n配置位置: ${ConfigManager.getConfigDir()}`));
          return;
        }

        // 默认交互式配置菜单
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: '选择配置项:',
            choices: [
              { name: '设置115网盘Cookie', value: 'cookie' },
              { name: '添加搜索频道', value: 'addChannel' },
              { name: '删除搜索频道', value: 'removeChannel' },
              { name: '设置代理', value: 'proxy' },
              { name: '查看当前配置', value: 'show' },
            ],
          },
        ]);

        // 递归调用以执行选中的操作
        switch (action) {
          case 'cookie':
            await program.parseAsync(['node', 'script', 'config', '--set-cookie']);
            break;
          case 'addChannel':
            await program.parseAsync(['node', 'script', 'config', '--add-channel']);
            break;
          case 'removeChannel':
            await program.parseAsync(['node', 'script', 'config', '--remove-channel']);
            break;
          case 'proxy':
            await program.parseAsync(['node', 'script', 'config', '--set-proxy']);
            break;
          case 'show':
            await program.parseAsync(['node', 'script', 'config', '--show']);
            break;
        }

      } catch (error) {
        console.error(chalk.red('配置失败:'), error);
        process.exit(1);
      }
    });
}
