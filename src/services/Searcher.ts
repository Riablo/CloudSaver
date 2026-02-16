import * as cheerio from 'cheerio';
import { SearchResult, CloudLink, Channel } from '../types';
import { createTelegramAxios } from '../utils/axiosInstance';

export class Searcher {
  private api = createTelegramAxios();

  // 网盘链接正则匹配
  private cloudPatterns = {
    pan115: /https?:\/\/(?:115|anxia|115cdn)\.com\/s\/[^\s<>"]+/g,
    aliyun: /https?:\/\/\w+\.(?:alipan|aliyundrive)\.com\/[^\s<>"]+/g,
    quark: /https?:\/\/pan\.quark\.cn\/[^\s<>"]+/g,
    baidu: /https?:\/\/(?:pan|yun)\.baidu\.com\/[^\s<>"]+/g,
    tianyi: /https?:\/\/cloud\.189\.cn\/[^\s<>"]+/g,
    pan123: /https?:\/\/(?:www\.)?123[^\/\s<>"]+\.com\/s\/[^\s<>"]+/g,
  };

  private extractCloudLinks(text: string): CloudLink[] {
    const links: CloudLink[] = [];
    
    Object.entries(this.cloudPatterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(url => {
          links.push({ url, type: type as CloudLink['type'] });
        });
      }
    });

    // 去重
    const unique = new Map<string, CloudLink>();
    links.forEach(link => unique.set(link.url, link));
    return Array.from(unique.values());
  }

  private getCloudTypePriority(type: string): number {
    const priority: Record<string, number> = {
      pan115: 1,
      aliyun: 2,
      quark: 3,
      baidu: 4,
      tianyi: 5,
      pan123: 6,
      unknown: 7,
    };
    return priority[type] || 7;
  }

  async searchChannel(channel: Channel, keyword: string): Promise<SearchResult[]> {
    try {
      const url = keyword 
        ? `/${channel.id}?q=${encodeURIComponent(keyword)}`
        : `/${channel.id}`;
      
      const response = await this.api.get(url);
      const html = response.data;
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $('.tgme_widget_message_wrap').each((_, element) => {
        const messageEl = $(element);
        
        // 提取消息ID
        const messageId = messageEl
          .find('.tgme_widget_message')
          .data('post')
          ?.toString()
          .split('/')[1] || '';

        // 提取标题
        const title = messageEl
          .find('.js-message_text')
          .html()
          ?.split('<br>')[0]
          .replace(/\u003c[^\u003e]+\u003e/g, '')
          .replace(/\n/g, '')
          .trim() || '';

        // 提取内容
        const content = messageEl
          .find('.js-message_text')
          .text()
          .replace(title, '')
          .trim() || '';

        // 提取发布时间
        const pubDate = messageEl.find('time').attr('datetime') || '';

        // 提取图片
        const image = messageEl
          .find('.tgme_widget_message_photo_wrap')
          .attr('style')
          ?.match(/url\('(.+?)'\)/)?.[1];

        // 提取标签
        const tags: string[] = [];
        messageEl.find('.tgme_widget_message_text a').each((_, el) => {
          const tagText = $(el).text();
          if (tagText && tagText.startsWith('#')) {
            tags.push(tagText);
          }
        });

        // 提取所有链接
        const allText = messageEl.find('.tgme_widget_message_text').html() || '';
        const cloudLinks = this.extractCloudLinks(allText);

        // 只保留包含网盘链接的结果
        if (cloudLinks.length > 0) {
          // 按优先级排序链接
          cloudLinks.sort((a, b) => 
            this.getCloudTypePriority(a.type) - this.getCloudTypePriority(b.type)
          );

          results.push({
            messageId,
            title: title || '无标题',
            content,
            pubDate,
            image,
            cloudLinks,
            tags,
            channel: channel.name,
            channelId: channel.id,
          });
        }
      });

      return results.reverse(); // 最新的在前面
    } catch (error) {
      console.error(`搜索频道 ${channel.name} 失败:`, error);
      return [];
    }
  }

  async searchAll(keyword: string, channels: Channel[]): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    
    // 串行搜索避免被封
    for (const channel of channels) {
      const results = await this.searchChannel(channel, keyword);
      allResults.push(...results);
    }

    // 按时间排序
    return allResults.sort((a, b) => 
      new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );
  }
}
