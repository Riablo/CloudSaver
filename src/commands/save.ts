import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Cloud115Service } from '../services/Cloud115Service';
import { ConfigManager } from '../config';

export function saveCommand(program: Command): void {
  program
    .command('save [url]')
    .alias('sv')
    .description('转存115网盘资源')
    .option('-f, --folder <id>', '指定目标文件夹ID')
    .action(async (url: string | undefined, options) => {
      try {
        const service = new Cloud115Service();

        // 检查 cookie
        if (!service.hasCookie()) {
          console.log(chalk.yellow('⚠️  请先设置115网盘Cookie:'));
          console.log(chalk.cyan('  cloudsaver config --set-cookie'));
          return;
        }

        let shareUrl: string;

        if (url) {
          // 验证URL格式
          if (!url.match(/(?:115|115cdn|anxia)\.com\/s\//)) {
            console.log(chalk.red('❌ 无效的115分享链接'));
            return;
          }
          shareUrl = url;
        } else {
          // 交互式输入
          const answer = await inquirer.prompt([
            {
              type: 'input',
              name: 'url',
              message: '请输入115分享链接:',
              validate: (input: string) => {
                if (!input.match(/(?:115|115cdn|anxia)\.com\/s\//)) {
                  return '请输入有效的115分享链接';
                }
                return true;
              },
            },
          ]);
          shareUrl = answer.url;
        }

        // 解析分享链接
        console.log(chalk.blue('\n🔗 解析分享链接...'));
        const { shareCode, receiveCode } = service.parseShareUrl(shareUrl);
        
        // 获取分享信息
        const files = await service.getShareInfo(shareCode, receiveCode || '');
        
        if (files.length === 0) {
          console.log(chalk.yellow('⚠️  分享中没有文件'));
          return;
        }

        console.log(chalk.green(`✅ 找到 ${files.length} 个文件:\n`));
        files.forEach((file, index) => {
          const size = formatFileSize(file.fileSize);
          console.log(`  ${index + 1}. ${file.fileName} (${size})`);
        });

        // 确定目标文件夹
        let targetFolderId = options.folder;
        let targetFolderName = '根目录';

        if (!targetFolderId) {
          // 使用默认配置或询问
          const config = ConfigManager.load();
          
          // 确保转存文件夹存在
          console.log(chalk.blue('\n📁 检查目标文件夹...'));
          const transferFolderId = await service.ensureTransferFolder();
          
          if (transferFolderId !== '0') {
            targetFolderId = transferFolderId;
            targetFolderName = '转存';
          } else {
            targetFolderId = config.cloud115.defaultFolder;
            targetFolderName = config.cloud115.defaultFolderName;
          }

          // 检查是否是 TTY 环境
          if (process.stdin.isTTY) {
            // 询问用户确认
            const { confirm } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirm',
                message: `是否转存到 "${targetFolderName}" 文件夹?`,
                default: true,
              },
            ]);

            if (!confirm) {
              // 列出文件夹让用户选择
              console.log(chalk.blue('\n📂 获取文件夹列表...'));
              const folders = await service.getFolderList('0');
              
              const { selectedFolder } = await inquirer.prompt([
                {
                  type: 'list',
                  name: 'selectedFolder',
                  message: '选择目标文件夹:',
                  choices: [
                    { name: '根目录', value: '0' },
                    ...folders.map(f => ({ name: f.name, value: f.cid })),
                  ],
                },
              ]);
              
              targetFolderId = selectedFolder;
              targetFolderName = selectedFolder === '0' ? '根目录' : 
                folders.find(f => f.cid === selectedFolder)?.name || '未知';
            }
          } else {
            // 非 TTY 环境，自动确认
            console.log(chalk.gray(`自动选择 "${targetFolderName}" 文件夹`));
          }
        }

        // 执行转存
        console.log(chalk.blue(`\n💾 开始转存到 "${targetFolderName}"...`));
        
        for (const file of files) {
          process.stdout.write(`  正在转存: ${file.fileName}... `);
          
          const result = await service.saveFile(
            shareCode,
            file.fileId,
            receiveCode || '',
            targetFolderId
          );

          if (result.success) {
            console.log(chalk.green('✅ 成功'));
          } else {
            console.log(chalk.red(`❌ 失败 - ${result.message}`));
          }
        }

        console.log(chalk.green('\n✅ 转存完成!'));

      } catch (error: any) {
        console.error(chalk.red('\n❌ 转存失败:'), error.message || error);
        
        if (error.message?.includes('登录')) {
          console.log(chalk.yellow('\n💡 提示: Cookie可能已过期，请重新设置'));
          console.log(chalk.cyan('  cloudsaver config --set-cookie'));
        }
        
        process.exit(1);
      }
    });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
