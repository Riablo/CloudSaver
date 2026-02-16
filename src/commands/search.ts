import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';
import { Searcher } from '../services/Searcher';
import { ConfigManager } from '../config';
import { SearchResult, CloudLink } from '../types';

const CloudTypeNames: Record<CloudLink['type'], string> = {
  pan115: '115网盘',
  aliyun: '阿里云盘',
  quark: '夸克网盘',
  baidu: '百度网盘',
  tianyi: '天翼云盘',
  pan123: '123云盘',
  unknown: '未知',
};

const getCloudTypeColor = (type: CloudLink['type']): string => {
  const colors: Record<CloudLink['type'], string> = {
    pan115: chalk.red.bold('115网盘'),
    aliyun: chalk.blue.bold('阿里云盘'),
    quark: chalk.yellow.bold('夸克网盘'),
    baidu: chalk.cyan.bold('百度网盘'),
    tianyi: chalk.magenta.bold('天翼云盘'),
    pan123: chalk.green.bold('123云盘'),
    unknown: chalk.gray('未知'),
  };
  return colors[type] || type;
};

export function searchCommand(program: Command): void {
  program
    .command('search <keyword>')
    .alias('s')
    .description('搜索网盘资源')
    .option('-l, --limit <number>', '限制结果数量', '20')
    .option('--no-table', '不使用表格格式输出')
    .action(async (keyword: string, options) => {
      try {
        const config = ConfigManager.load();
        
        if (config.search.channels.length === 0) {
          console.log(chalk.yellow('⚠️  请先配置搜索频道:'));
          console.log(chalk.cyan('  cloudsaver config --add-channel'));
          return;
        }

        console.log(chalk.blue(`🔍 正在搜索: "${keyword}"...`));
        console.log(chalk.gray(`📡 搜索 ${config.search.channels.length} 个频道...\n`));

        const searcher = new Searcher();
        const results = await searcher.searchAll(keyword, config.search.channels);

        if (results.length === 0) {
          console.log(chalk.yellow('❌ 未找到相关资源'));
          return;
        }

        // 限制结果数量
        const limit = parseInt(options.limit, 10) || 20;
        const limited = results.slice(0, limit);

        console.log(chalk.green(`✅ 找到 ${results.length} 个资源${results.length > limit ? `，显示前 ${limit} 个` : ''}\n`));

        if (options.table !== false) {
          // 表格输出
          const tableData = [
            ['序号', '名称', '网盘', '链接', '频道', '时间'].map(h => chalk.bold(h)),
            ...limited.map((item, index) => {
              const firstLink = item.cloudLinks[0];
              return [
                (index + 1).toString(),
                item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title,
                CloudTypeNames[firstLink.type],
                firstLink.url.length > 35 ? firstLink.url.substring(0, 35) + '...' : firstLink.url,
                item.channel,
                new Date(item.pubDate).toLocaleDateString(),
              ];
            }),
          ];

          console.log(table(tableData, {
            border: {
              topBody: '─',
              topJoin: '┬',
              topLeft: '┌',
              topRight: '┐',
              bottomBody: '─',
              bottomJoin: '┴',
              bottomLeft: '└',
              bottomRight: '┘',
              bodyLeft: '│',
              bodyRight: '│',
              bodyJoin: '│',
              joinBody: '─',
              joinLeft: '├',
              joinRight: '┤',
              joinJoin: '┼',
            },
          }));

          // 显示所有链接详情
          console.log('\n' + chalk.bold('📋 链接详情:'));
          limited.forEach((item, index) => {
            console.log(`\n${chalk.bold(`${index + 1}. ${item.title}`)}`);
            item.cloudLinks.forEach((link, idx) => {
              console.log(`   ${idx + 1}) ${getCloudTypeColor(link.type)}: ${chalk.underline(link.url)}`);
            });
          });
        } else {
          // 简单列表输出
          limited.forEach((item, index) => {
            console.log(`${chalk.bold(`${index + 1}. ${item.title}`)}`);
            console.log(`   频道: ${item.channel} | 时间: ${new Date(item.pubDate).toLocaleString()}`);
            item.cloudLinks.forEach((link, idx) => {
              console.log(`   ${idx + 1}) ${getCloudTypeColor(link.type)}: ${link.url}`);
            });
            console.log();
          });
        }

        // 提示转存
        const has115 = limited.some(r => r.cloudLinks.some(l => l.type === 'pan115'));
        if (has115) {
          console.log(chalk.cyan('\n💡 提示: 使用 `cloudsaver save` 命令可以转存115网盘资源'));
        }

      } catch (error) {
        console.error(chalk.red('搜索失败:'), error);
        process.exit(1);
      }
    });
}
