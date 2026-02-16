import axios, { AxiosInstance, AxiosHeaders } from 'axios';
import { ShareInfo, FolderInfo } from '../types';
import { ConfigManager } from '../config';

interface Cloud115ListItem {
  cid: string;
  n: string;
  s: number;
}

interface Cloud115FolderItem {
  cid: string;
  n: string;
  ns: number;
}

export class Cloud115Service {
  private api: AxiosInstance;
  private cookie: string = '';

  constructor() {
    this.api = axios.create({
      baseURL: 'https://webapi.115.com',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 MicroMessenger/6.8.0(0x16080000) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.9(0x13080910) XWEB/1227',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': '',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Referer': 'https://servicewechat.com/wx2c744c010a61b0fa/94/page-frame.html',
      },
    });

    // 请求拦截器添加 cookie
    this.api.interceptors.request.use((config) => {
      if (this.cookie) {
        config.headers.cookie = this.cookie;
      }
      return config;
    });

    this.loadCookie();
  }

  private loadCookie(): void {
    const config = ConfigManager.load();
    this.cookie = config.cloud115.cookie;
  }

  setCookie(cookie: string): void {
    this.cookie = cookie;
    const config = ConfigManager.load();
    ConfigManager.save({
      cloud115: {
        ...config.cloud115,
        cookie,
      },
    });
  }

  hasCookie(): boolean {
    return !!this.cookie;
  }

  // 解析分享链接
  parseShareUrl(url: string): { shareCode: string; receiveCode?: string } {
    const match = url.match(/(?:115|115cdn|anxia)\.com\/s\/([^?]+)(?:\?password=(\w+))?/);
    if (!match) {
      throw new Error('无效的115分享链接');
    }
    return {
      shareCode: match[1],
      receiveCode: match[2],
    };
  }

  // 获取分享信息
  async getShareInfo(shareCode: string, receiveCode = ''): Promise<ShareInfo[]> {
    const response = await this.api.get('/share/snap', {
      params: {
        share_code: shareCode,
        receive_code: receiveCode,
        offset: 0,
        limit: 50,
        cid: '',
      },
    });

    if (response.data?.state && response.data.data?.list) {
      return response.data.data.list.map((item: Cloud115ListItem) => ({
        fileId: item.cid,
        fileName: item.n,
        fileSize: item.s,
      }));
    } else {
      throw new Error(response.data?.error || '获取分享信息失败');
    }
  }

  // 获取文件夹列表
  async getFolderList(parentCid = '0'): Promise<FolderInfo[]> {
    const response = await this.api.get('/files', {
      params: {
        aid: 1,
        cid: parentCid,
        o: 'user_ptime',
        asc: 1,
        offset: 0,
        show_dir: 1,
        limit: 50,
        type: 0,
        format: 'json',
      },
    });

    if (response.data?.state) {
      return response.data.data
        .filter((item: Cloud115FolderItem) => item.cid && !!item.ns)
        .map((folder: Cloud115FolderItem) => ({
          cid: folder.cid,
          name: folder.n,
        }));
    } else {
      throw new Error(response.data?.error || '获取文件夹列表失败');
    }
  }

  // 转存文件
  async saveFile(
    shareCode: string, 
    fileId: string, 
    receiveCode = '', 
    folderId = '0'
  ): Promise<{ success: boolean; message: string }> {
    const params = new URLSearchParams({
      cid: folderId,
      share_code: shareCode,
      receive_code: receiveCode,
      file_id: fileId,
    });

    const response = await this.api.post('/share/receive', params.toString());
    
    if (response.data?.state) {
      return {
        success: true,
        message: '转存成功',
      };
    } else {
      return {
        success: false,
        message: response.data?.error || '转存失败',
      };
    }
  }

  // 创建文件夹
  async createFolder(name: string, parentCid = '0'): Promise<string> {
    const params = new URLSearchParams({
      pid: parentCid,
      file_name: name,
    });

    const response = await this.api.post('/files/add', params.toString());
    
    if (response.data?.state) {
      return response.data.cid;
    } else {
      throw new Error(response.data?.error || '创建文件夹失败');
    }
  }

  // 确保"转存"文件夹存在
  async ensureTransferFolder(): Promise<string> {
    try {
      const folders = await this.getFolderList('0');
      const transferFolder = folders.find(f => f.name === '转存');
      
      if (transferFolder) {
        return transferFolder.cid;
      }
      
      // 创建转存文件夹
      return await this.createFolder('转存', '0');
    } catch (error) {
      console.error('确保转存文件夹存在失败:', error);
      return '0'; // fallback 到根目录
    }
  }
}
