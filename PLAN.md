# CloudSaver CLI 重构计划

## 项目概述

将 CloudSaver Web 项目重构为纯 CLI 版本，专注于核心功能：**搜索资源** 和 **115网盘转存**。

## 核心需求

### 功能保留
1. **搜索资源**: 从 Telegram 频道搜索网盘资源
2. **115转存**: 将115网盘资源转存到个人网盘

### 功能舍弃
- Web UI (Vue 前端)
- 用户系统 (注册/登录/JWT)
- 数据库 (SQLite)
- 多用户支持
- 夸克/天翼/123云盘的转存功能（仅保留链接展示）
- Docker 部署
- 豆瓣榜单

### 网盘优先级
1. **115网盘** - 优先展示，支持转存
2. **阿里云盘** - 仅展示链接
3. **夸克网盘** - 仅展示链接
4. 其他网盘 - 忽略

## 技术栈

- **语言**: TypeScript
- **运行时**: Node.js >= 18
- **CLI框架**: Commander.js
- **HTTP请求**: Axios
- **HTML解析**: Cheerio
- **终端美化**: Chalk + Table
- **交互提示**: Inquirer.js
- **配置管理**: Node-config 或自建配置管理

## 文件结构

```
cloudsaver-cli/
├── src/
│   ├── commands/
│   │   ├── search.ts          # 搜索命令
│   │   ├── save.ts            # 转存命令
│   │   └── config.ts          # 配置管理命令
│   ├── services/
│   │   ├── Searcher.ts        # 搜索服务
│   │   └── Cloud115Service.ts # 115网盘服务
│   ├── config/
│   │   └── index.ts           # 配置文件
│   ├── types/
│   │   └── index.ts           # 类型定义
│   ├── utils/
│   │   ├── axiosInstance.ts   # HTTP实例
│   │   └── logger.ts          # 日志工具
│   └── index.ts               # CLI入口
├── dist/                      # 编译输出
├── config/
│   └── local.json             # 本地配置(cookie等敏感信息)
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 详细设计

### 1. 命令设计

#### 1.1 搜索命令
```bash
# 基础搜索
cloudsaver search "电影名称"

# 指定频道搜索
cloudsaver search "电影名称" --channel "channel_id"

# 限制结果数量
cloudsaver search "电影名称" --limit 20
```

#### 1.2 转存命令
```bash
# 转存115资源（交互式选择）
cloudsaver save

# 直接转存指定链接
cloudsaver save "https://115.com/s/xxxx"

# 指定目标文件夹
cloudsaver save "https://115.com/s/xxxx" --folder "folder_id"
```

#### 1.3 配置命令
```bash
# 设置115 cookie
cloudsaver config --set-cookie

# 添加搜索频道
cloudsaver config --add-channel

# 查看配置
cloudsaver config --show
```

### 2. 配置管理

#### 配置文件位置
- **全局配置**: `~/.config/cloudsaver/config.json`
- **敏感信息**: `~/.config/cloudsaver/local.json` (cookie等)

#### 配置内容
```typescript
interface Config {
  // 搜索配置
  search: {
    channels: {
      id: string;
      name: string;
    }[];
    proxy?: {
      enabled: boolean;
      host: string;
      port: number;
    };
  };
  
  // 115网盘配置
  cloud115: {
    cookie: string;
    defaultFolder: string;  // 默认转存文件夹ID
  };
}
```

### 3. 搜索功能

#### 搜索流程
1. 解析用户输入的关键词
2. 遍历配置的 Telegram 频道
3. 使用 axios + cheerio 抓取搜索结果
4. 提取网盘链接（使用正则匹配）
5. 按网盘类型分类整理
6. 以表格形式展示结果

#### 结果展示格式
```
┌────┬────────────────┬──────────┬─────────────────────────┬────────┐
│ 序号 │ 名称           │ 网盘类型 │ 链接                    │ 频道   │
├────┼────────────────┼──────────┼─────────────────────────┼────────┤
│ 1   │ 电影名称1      │ 115      │ https://115.com/s/xxx  │ 频道A  │
│ 2   │ 电影名称2      │ 阿里云   │ https://alipan.com/xxx │ 频道B  │
│ 3   │ 电影名称3      │ 夸克     │ https://pan.quark.cn/xx│ 频道A  │
└────┴────────────────┴──────────┴─────────────────────────┴────────┘
```

### 4. 115转存功能

#### 转存流程
1. 检查 cookie 是否配置
2. 解析分享链接（提取 share_code 和 receive_code）
3. 获取分享文件列表
4. 选择目标文件夹（默认根目录/转存）
5. 调用 115 API 进行转存
6. 显示转存结果

#### 文件夹管理
- 默认转存到根目录下的"转存"文件夹
- 支持列出用户网盘文件夹列表
- 支持交互式选择目标文件夹

### 5. 安全考虑

#### 敏感信息处理
- Cookie 存储在 `~/.config/cloudsaver/local.json`
- `.gitignore` 中排除所有配置文件目录
- 配置文件权限设置为 600 (仅用户可读)
- 日志中自动脱敏敏感信息

#### 数据安全
- 不提交任何敏感信息到 GitHub
- 本地配置与项目代码分离
- 提供配置初始化向导

## 开发步骤

### Phase 1: 项目初始化
1. 创建 package.json，安装依赖
2. 配置 TypeScript 环境
3. 创建 CLI 入口文件
4. 设置配置文件管理

### Phase 2: 搜索功能
1. 实现 Searcher 服务（从原项目迁移简化）
2. 实现搜索命令
3. 添加结果展示表格
4. 测试搜索功能

### Phase 3: 115转存功能
1. 实现 Cloud115Service 服务（从原项目迁移简化）
2. 实现转存命令
3. 添加交互式文件夹选择
4. 测试转存功能

### Phase 4: 配置管理
1. 实现配置命令
2. 添加配置向导
3. 配置验证

### Phase 5: 优化与测试
1. 错误处理优化
2. 日志输出优化
3. 帮助文档完善
4. 端到端测试

## 依赖清单

### 生产依赖
```json
{
  "axios": "^1.x",
  "cheerio": "^1.x",
  "commander": "^12.x",
  "chalk": "^5.x",
  "inquirer": "^9.x",
  "table": "^6.x",
  "fs-extra": "^11.x"
}
```

### 开发依赖
```json
{
  "typescript": "^5.x",
  "@types/node": "^20.x",
  "@types/inquirer": "^9.x",
  "ts-node": "^10.x"
}
```

## 注意事项

1. **代理支持**: 搜索功能可能需要代理，需要在配置中支持 HTTP 代理设置
2. **Cookie有效期**: 115 cookie 会过期，需要提醒用户定期更新
3. **频道配置**: Telegram 频道需要用户自行配置，不提供默认频道
4. **错误处理**: 网络请求可能失败，需要良好的错误提示
5. **并发控制**: 搜索多个频道时，需要控制并发数避免被封

## 后续扩展（可选）

1. 支持阿里云盘转存
2. 支持资源历史记录
3. 支持批量转存
4. 支持资源订阅监控
5. 支持结果导出(JSON/CSV)
