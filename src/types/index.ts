export interface SearchResult {
  messageId: string;
  title: string;
  content: string;
  pubDate: string;
  image?: string;
  cloudLinks: CloudLink[];
  tags: string[];
  channel: string;
  channelId: string;
}

export interface CloudLink {
  url: string;
  type: 'pan115' | 'aliyun' | 'quark' | 'baidu' | 'tianyi' | 'pan123' | 'unknown';
}

export interface Channel {
  id: string;
  name: string;
}

export interface Config {
  search: {
    channels: Channel[];
    proxy?: {
      enabled: boolean;
      host: string;
      port: number;
    };
  };
  cloud115: {
    cookie: string;
    defaultFolder: string;
    defaultFolderName: string;
  };
}

export interface ShareInfo {
  fileId: string;
  fileName: string;
  fileSize: number;
}

export interface FolderInfo {
  cid: string;
  name: string;
}
