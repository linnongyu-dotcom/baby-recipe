# 部署说明文档

饭小宝 - 宝宝营养食谱管家

## 1. 部署架构

```
push 到 GitHub main 分支
        │
        ▼
GitHub Actions（build-and-deploy）
        │  npm ci → npm run build
        ▼
scripts/deploy-cloudbase.cjs（@cloudbase/manager-node + COS SDK）
        │
        ▼
腾讯云 CloudBase 静态托管
```

- **主部署**：腾讯云 CloudBase 静态托管（自动）
- **备份部署**：Netlify（当前团队账号额度受限，暂停中，恢复后可重新启用）

## 2. 关键信息

| 项目 | 值 |
| --- | --- |
| GitHub 仓库 | `linnongyu-dotcom/baby-recipe` |
| 部署分支 | `main` |
| CloudBase 环境 ID | `fanxiaobao-d9gpf87uvf3323ae7` |
| 线上访问地址 | `https://fanxiaobao-d9gpf87uvf3323ae7-1253307239.tcloudbaseapp.com/` |
| 构建产物目录 | `dist/` |

> ⚠️ 访问地址必须带 `-1253307239`（appid 后缀），去掉会返回 418。

## 3. 自动部署（推荐，日常更新用）

每次 push 代码到 `main` 分支，GitHub Actions 会自动构建并部署，无需手动操作。

### 3.1 配置 GitHub Secrets（一次性）

仓库 Settings → Secrets and variables → Actions → New repository secret，添加两个密钥：

| Secret 名称 | 值 |
| --- | --- |
| `TCB_SECRET_ID` | 腾讯云 SecretId |
| `TCB_SECRET_KEY` | 腾讯云 SecretKey |

### 3.2 触发方式

1. `git push origin main`（自动触发）
2. GitHub 网页上手动触发：Actions → Deploy to CloudBase → Run workflow

### 3.3 查看部署状态

GitHub → Actions → Deploy to CloudBase，绿色对勾表示成功（约 3 分钟）。失败可点开日志定位原因。

## 4. 手动部署（本地调试用）

```bash
# 1. 安装依赖
npm install

# 2. 构建
npm run build

# 3. 部署（需要环境变量，或直接传参）
TCB_SECRET_ID=xxx TCB_SECRET_KEY=xxx node scripts/deploy-cloudbase.cjs
# 等价写法：node scripts/deploy-cloudbase.cjs <SecretId> <SecretKey>
```

部署脚本说明（`scripts/deploy-cloudbase.cjs`）：

- 通过 `hosting.getInfo()` 动态获取真实 Bucket 与 Region（勿硬编码）
- 小于 2MB 的文件用 `putObject` 直传；大文件用 `sliceUploadFile` 分片（1MB 分片、并发 2、失败重试 5 次）
- 并发 4 个小并发上传，避免海外网络超时
- 自动跳过 `.DS_Store` 与 `.map` 文件
- 上传完成后自动配置 SPA 路由（`index.html` 兜底）

## 5. 验证线上是否可访问

```bash
curl -s -o /dev/null -w "%{http_code}" https://fanxiaobao-d9gpf87uvf3323ae7-1253307239.tcloudbaseapp.com/
# 期望输出：200
```

页面正常返回 HTTP 200，标题为「饭小宝 - 宝宝营养食谱管家」。

## 6. Netlify 备份部署

配置文件：`netlify.toml`（build 命令 `npm run build`，发布目录 `dist`，含 SPA 重定向与静态资源缓存）。

当前状态：**Vicky 团队账号依赖运营信用额度，生产环境部署与代理运行程序已暂停**，已发布站点仍在线，但无法部署新代码。恢复方式：

- 升级团队套餐，或
- 等待下一个计费周期恢复服务

恢复后重新在 Netlify 控制台连接 GitHub 仓库即可自动同步，无需改配置。

## 7. 常见问题排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 访问返回 418 | 使用了不带 `-1253307239` 的域名 | 改用带 appid 后缀的完整地址 |
| Actions 报 `User network is too slow` | 大文件直传超时 | 脚本已用分片上传（1MB）+ 重试 5 次解决 |
| Actions 报 `CloudBase is not a constructor` | manager-node v5 导出方式变化 | 已改为 `const CloudBase = require('@cloudbase/manager-node')` |
| Actions 报 `hosting.upload is not a function` | API 变更 | 已改用 `uploadFiles`/COS SDK |
| Actions 403 权限不足 | GitHub Token 权限不足 | 使用 classic token（`ghp_` 开头，勾选 repo + workflow） |
| dist 目录不存在 | 未先构建 | 先执行 `npm run build` |
