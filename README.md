# 宝拓导航 (BTNAV)

一个基于 Vue 3 + Vite 的品牌化导航站，支持分类导航、后台可视化管理、GitHub 仓库回写，以及本地“我的常用”点击 Top 榜。

- 项目仓库: [https://github.com/baotuo88/baotuo_nav](https://github.com/baotuo88/baotuo_nav)
- 在线部署推荐: `Vercel` 或 `Cloudflare Pages`
- Node.js 要求: `>= 18`

![预览图](preview.png)

## 特性

- 响应式首页，适配桌面端和移动端
- 分类导航、搜索引擎切换、深色模式
- 后台登录与管理页，支持分类和站点可视化维护
- 后台通过同源 `/api/admin` 读写 GitHub，不再把 Token 暴露到前端
- “我的常用”支持本地点击统计，固定显示点击最多的前几项
- 支持 Vercel、Cloudflare Pages，以及纯静态托管

## 更新记录

- `2026-03-24` 后台安全改造：GitHub 读写迁移到同源 `/api/admin`，管理员登录改为 HttpOnly Cookie。
- `2026-03-24` 首页重构：拆分首页组件，增强品牌化布局与导航体验。
- `2026-03-24` “我的常用”改为本地点击 Top 榜，固定显示前 `5` 个站点。
- `2025-08-11` 增加夜间模式和默认搜索引擎设置。
- `2025-07-30` 增加首页访问保护开关 `VITE_OPEN_LOCK`。

## 先选部署模式

这个项目有两种部署方式，先选清楚再部署。

### 方式一：纯静态导航

适合场景：

- 只想展示导航页
- 直接改 `src/mock/mock_data.js`
- 不需要后台管理
- 可以部署到任意静态托管

特点：

- 不需要配置服务端环境变量
- 不支持 `/admin` 后台保存到 GitHub
- 首页“我的常用”仍然可用，但只在当前浏览器本地记录点击数据

### 方式二：带后台管理的完整部署

适合场景：

- 需要通过后台添加、编辑、删除分类和站点
- 需要把导航数据保存回 GitHub 仓库
- 需要管理员登录、服务端会话和 GitHub Token

特点：

- 推荐部署到 `Vercel` 或 `Cloudflare Pages`
- 前端通过同源 `/api/admin` 调用服务端接口
- 后台保存后，会更新仓库里的 `src/mock/mock_data.js`
- 你的平台会因为 Git 提交或仓库更新而重新部署

## 部署架构说明

当前版本不是“纯前端后台”了，而是：

- 首页前台：静态资源
- 后台接口：同源 `/api/admin`
- 会话：HttpOnly Cookie
- 数据源：GitHub 仓库中的 `src/mock/mock_data.js`

平台侧接口入口如下：

- `Vercel`: `api/admin/[...route].js`
- `Cloudflare Pages`: `functions/api/admin/*.js`
- 本地开发：`vite.config.js` 里挂载开发中间件代理 `/api/admin`

## 快速开始

### 本地开发

```bash
git clone https://github.com/baotuo88/baotuo_nav.git
cd baotuo_nav
npm install
cp .env.example .env
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。

如果你只看前台页面，不配置 `.env` 也能运行。  
如果你要测试后台保存功能，需要先补齐服务端环境变量。

### 本地构建

```bash
npm run lint
npm run build
```

## 环境变量

### 必填环境变量

如果你要启用后台管理，至少需要这些变量：

```bash
ADMIN_PASSWORD=your_admin_password_here
ADMIN_SESSION_SECRET=replace_with_a_long_random_string
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=baotuo88
GITHUB_REPO=baotuo_nav
GITHUB_BRANCH=master
```

### 可选环境变量

```bash
VITE_OPEN_LOCK=true
VITE_OPEN_LOCK_PASSWORD=your_public_lock_password
```

### 变量说明

| 变量名 | 是否必需 | 用途 | 放在哪里 |
| --- | --- | --- | --- |
| `ADMIN_PASSWORD` | 后台必需 | 后台登录密码 | 服务端环境变量 |
| `ADMIN_SESSION_SECRET` | 强烈建议 | 签名管理员会话 Cookie | 服务端环境变量 |
| `GITHUB_TOKEN` | 后台必需 | 读写 GitHub 仓库 | 服务端环境变量 |
| `GITHUB_OWNER` | 后台必需 | GitHub 仓库拥有者 | 服务端环境变量 |
| `GITHUB_REPO` | 后台必需 | GitHub 仓库名 | 服务端环境变量 |
| `GITHUB_BRANCH` | 后台必需 | 写入分支名，如 `main` 或 `master` | 服务端环境变量 |
| `VITE_OPEN_LOCK` | 可选 | 首页访问锁开关 | 前端环境变量 |
| `VITE_OPEN_LOCK_PASSWORD` | 可选 | 首页访问密码 | 前端环境变量 |

说明：

- `ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`、`GITHUB_TOKEN` 只能放在服务端环境变量中。
- `VITE_OPEN_LOCK_PASSWORD` 是前台访问门槛，不要和后台管理员密码复用。
- 你当前仓库默认示例分支是 `master`，如果你的仓库实际是 `main`，记得把 `GITHUB_BRANCH` 改成 `main`。

## GitHub Token 权限

推荐使用 fine-grained token，并且只授权当前 `baotuo_nav` 仓库。

最少需要：

- `Contents`: `Read and write`
- `Metadata`: `Read`

Token 生成位置：

- [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)

## 部署到 Vercel

适合需要后台管理的完整部署。

### 1. 导入仓库

1. Fork 或直接使用你的 `baotuo_nav` 仓库
2. 登录 [Vercel](https://vercel.com/)
3. 点击 `Add New` → `Project`
4. 选择仓库并导入

### 2. 构建设置

保持以下配置：

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

项目内已包含：

- `api/admin/[...route].js`，用于承接后台接口
- `vercel.json`，用于前端路由回退

### 3. 添加环境变量

在 Vercel 项目设置中添加：

```bash
ADMIN_PASSWORD=your_admin_password_here
ADMIN_SESSION_SECRET=replace_with_a_long_random_string
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_github_name
GITHUB_REPO=baotuo_nav
GITHUB_BRANCH=main
VITE_OPEN_LOCK=true
VITE_OPEN_LOCK_PASSWORD=your_public_lock_password
```

如果你不需要首页访问锁，可以不填 `VITE_OPEN_LOCK` 和 `VITE_OPEN_LOCK_PASSWORD`。

### 4. 部署后验证

部署完成后，至少验证这几个地址：

- `/`
- `/admin/login`
- `/admin`

后台验证建议流程：

1. 访问 `/admin/login`
2. 输入 `ADMIN_PASSWORD`
3. 进入后台修改任意分类或站点
4. 点击保存
5. 确认 GitHub 仓库里的 `src/mock/mock_data.js` 已更新

## 部署到 Cloudflare Pages

同样适合需要后台管理的完整部署。

### 1. 导入仓库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 `Workers & Pages`
3. 点击 `Create application`
4. 选择 `Pages` → `Connect to Git`
5. 连接你的 `baotuo_nav` 仓库

### 2. 构建设置

使用以下配置：

- Framework preset: `Vue`
- Build command: `npm run build`
- Build output directory: `dist`

项目内已包含：

- `functions/api/admin/*.js`，用于 Cloudflare Pages Functions
- `public/_redirects`，用于 SPA 路由回退
- `wrangler.toml`，用于本地或平台侧构建配置参考

### 3. 添加环境变量

在 Pages 项目设置的环境变量里添加：

```bash
ADMIN_PASSWORD=your_admin_password_here
ADMIN_SESSION_SECRET=replace_with_a_long_random_string
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_github_name
GITHUB_REPO=baotuo_nav
GITHUB_BRANCH=main
VITE_OPEN_LOCK=true
VITE_OPEN_LOCK_PASSWORD=your_public_lock_password
```

### 4. 部署后验证

验证流程和 Vercel 一样：

- 首页能正常打开
- `/admin/login` 可访问
- 登录后能保存数据到 GitHub

## 部署到纯静态托管

适合不需要后台管理的场景，例如：

- Nginx
- Apache
- 宝塔静态站点
- Netlify 静态部署
- GitHub Pages

### 1. 构建项目

```bash
npm install
npm run build
```

### 2. 上传 `dist`

把 `dist` 目录上传到你的静态站点根目录。

### 3. 配置 SPA 回退

如果你的平台支持重写规则，需要保证前端路由都回退到 `index.html`。

项目里已经准备了常用规则：

- Netlify / Cloudflare Pages: `public/_redirects`
- Apache: `public/.htaccess`
- Vercel: `vercel.json`

### 4. 静态部署的限制

纯静态部署下：

- 首页可以正常使用
- 搜索、分类、深色模式都可用
- `/admin/login` 页面可以打开，但后台保存到 GitHub 不可用
- 如果没有服务端 `/api/admin`，后台登录和保存都会失败

## 后台工作原理

后台不是直接改线上数据库，而是：

1. 管理员登录 `/admin/login`
2. 服务端用 `ADMIN_PASSWORD` 验证身份
3. 服务端发出 HttpOnly Cookie
4. 后台通过 `/api/admin/navigation` 读取或保存数据
5. 服务端使用 `GITHUB_TOKEN` 修改 GitHub 仓库中的 `src/mock/mock_data.js`
6. Git 平台触发自动重新部署

所以你真正需要保证的是：

- 平台支持前端静态资源
- 平台支持服务端函数
- 平台已配置 GitHub 相关环境变量

## 自定义导航数据

### 方式一：直接改文件

直接编辑 [src/mock/mock_data.js](src/mock/mock_data.js)：

```javascript
export const mockData = {
  title: '宝拓导航',
  search: 'bing',
  categories: [
    {
      id: 'ai-tools',
      name: 'AI智能',
      icon: '🤖',
      order: 1,
      sites: [
        {
          id: 'chatgpt',
          name: 'ChatGPT',
          url: 'https://chatgpt.com',
          description: 'OpenAI 对话助手',
          icon: '/sitelogo/chatgpt.com.ico'
        }
      ]
    }
  ]
}
```

### 方式二：使用后台

1. 部署到支持服务端函数的平台
2. 配置好后台环境变量
3. 访问 `/admin/login`
4. 登录后进入 `/admin`
5. 编辑分类、站点、标题和默认搜索引擎
6. 保存后等待平台重新部署

## 项目结构

```text
baotuo_nav/
├── api/                     # Vercel Serverless 入口
├── functions/               # Cloudflare Pages Functions
├── public/                  # 公共静态资源和路由回退规则
├── server/                  # 服务端管理接口核心逻辑
├── src/
│   ├── apis/                # 前端 API 封装
│   ├── assets/              # 图片和样式
│   ├── components/          # 页面组件
│   ├── mock/                # 导航数据源
│   ├── router/              # 路由
│   ├── stores/              # Pinia 状态
│   └── views/               # 页面
├── .env.example             # 环境变量示例
├── vercel.json              # Vercel 路由回退
├── vite.config.js           # Vite 与本地开发接口接入
└── wrangler.toml            # Cloudflare 构建配置
```

## 常用命令

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

说明：

- `npm run lint` 当前会执行 `eslint . --fix`，也就是会直接修复部分格式问题。

## 部署前检查清单

- [ ] 已确认是“纯静态部署”还是“带后台部署”
- [ ] 已修改 `src/mock/mock_data.js` 为自己的导航数据
- [ ] 已确认 `GITHUB_BRANCH` 与仓库实际分支一致
- [ ] 已在平台配置 `ADMIN_PASSWORD`
- [ ] 已在平台配置 `ADMIN_SESSION_SECRET`
- [ ] 已在平台配置 `GITHUB_TOKEN`
- [ ] 已在平台配置 `GITHUB_OWNER`
- [ ] 已在平台配置 `GITHUB_REPO`
- [ ] 已执行 `npm run lint`
- [ ] 已执行 `npm run build`
- [ ] 已验证 `/` 和 `/admin/login`

## 常见问题

### 1. 为什么首页能打开，但后台保存失败？

通常是以下原因之一：

- 你部署在纯静态托管，没有 `/api/admin`
- 没配 `ADMIN_PASSWORD`
- 没配 `GITHUB_TOKEN`
- `GITHUB_BRANCH` 写错了
- Token 没有 `Contents: Read and write`

### 2. “我的常用”是全站共享的吗？

不是。当前版本是浏览器本地点击统计，只对当前设备、当前浏览器生效。

### 3. 为什么 `/admin` 会跳转到 `/admin/login`？

这是正常行为。当前版本后台有真实的路由守卫和服务端会话验证，未登录不会直接进入管理页。

## 贡献

欢迎提交 Issue 和 Pull Request。
