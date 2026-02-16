import axios, { AxiosInstance, AxiosProxyConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ConfigManager } from '../config';

export function createAxiosInstance(
  baseURL: string,
  headers?: Record<string, string>,
  useProxy: boolean = false,
  proxyConfig?: { host: string; port: number }
): AxiosInstance {
  const config: any = {
    baseURL,
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...headers,
    },
  };

  if (useProxy && proxyConfig) {
    const proxyUrl = `http://${proxyConfig.host}:${proxyConfig.port}`;
    config.httpsAgent = new HttpsProxyAgent(proxyUrl);
    config.httpAgent = new HttpsProxyAgent(proxyUrl);
  }

  return axios.create(config);
}

export function createTelegramAxios(proxyEnabled?: boolean): AxiosInstance {
  const config = ConfigManager.load();
  const proxy = config.search.proxy;
  
  return createAxiosInstance(
    'https://t.me/s',
    {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'max-age=0',
    },
    proxyEnabled ?? proxy?.enabled,
    proxy?.enabled ? proxy : undefined
  );
}
