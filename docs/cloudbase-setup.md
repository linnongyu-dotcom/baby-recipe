# CloudBase 云同步配置

饭小宝保持本地优先：未配置或未登录时只读写 `fanxiaobao:guest`，不会请求云数据库；登录后使用 `fanxiaobao:user:{uid}` 和 `user_spaces` 集合。

## 控制台手动配置

1. 创建/选择 CloudBase 环境，复制**环境 ID**，不要创建或复制 SecretId、SecretKey 到前端。
2. 在「身份认证 > 登录方式」中启用**邮箱验证码**，配置发信域名/模板和允许的 Web 域名。当前代码只接受 SDK 的邮箱验证码接口；若所选环境或 Web SDK 版本未提供该能力，会明确报错，不会降级到手机、微信、匿名或自建认证。
3. 在「数据库」创建集合 `user_spaces`，不要选择“所有用户可读写”。
4. 将 `cloudbase/database.rules.json` 配置为该集合的安全规则。若控制台只支持 read/write 两项，使用：

   ```json
   {
     "read": "auth.uid != null && doc.userId == auth.uid",
     "write": "auth.uid != null && doc.userId == auth.uid"
   }
   ```

   支持 create/update/delete 时，应使用仓库规则文件，以同时约束创建后的 `request.document.userId`，防止改变文档归属。
5. 将生产域名和本地开发域名加入 Web 安全域名/跨域白名单。
6. 从 `.env.example` 创建未提交的 `.env.local`，只填写公开环境 ID：`VITE_CLOUDBASE_ENV_ID=...`。

饭小宝当前环境 ID 为 `fanxiaobao-d9gpf87uvf3323ae7`。GitHub Actions 在构建任务中显式注入该公开值；CloudBase 控制台 Git 部署也必须配置同名的构建环境变量。邮箱验证码登录使用 Web SDK 的 `getVerification({ email })` 获取一次性的 `verificationInfo`，随后将其连同验证码传给 `signInWithEmail(...)`。

## 数据与迁移

- 原 persist key 为 `baby-recipe-storage`，迁移版本 1 会幂等复制到 `fanxiaobao:guest`；确认新空间保存前不会删除原 key。
- 云端是一位 uid 一条整文档，`schemaVersion=1`；每次成功写入递增 `revision`，时间为毫秒时间戳。
- 同步字段仅包括宝宝/当前宝宝、个人与自定义食谱、收藏、周计划、设置和食材记录。公共食谱、搜索、弹窗、loading、图片/PDF 均不进入文档。
- 两端都有有效数据时必须人工选择。本期不自动合并。

## 当前限制

- 邮箱验证码方法需要 CloudBase 环境及 Web SDK 版本实际支持；不同 CloudBase 产品代际若使用不同方法名，应升级 SDK/按控制台官方文档调整适配层，不能换用其他身份方案。
- 整文档同步适合验证期数据量；接近文档大小/写入频率限制后再按宝宝、计划等拆集合。
- 页面关闭时浏览器不保证异步写入完成，修改仍保留在账号本地缓存，用户下次登录可重试。
