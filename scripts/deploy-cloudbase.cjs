/**
 * CloudBase 静态托管部署脚本
 * 支持环境变量或命令行参数
 * 用法: node scripts/deploy-cloudbase.cjs <secretId> <secretKey>
 */
const CloudBase = require('@cloudbase/manager-node');
const path = require('path');
const fs = require('fs');

const envId = 'fanxiaobao-d9gpf87uvf3323ae7';
const secretId = process.env.TCB_SECRET_ID || process.argv[2];
const secretKey = process.env.TCB_SECRET_KEY || process.argv[3];
const distPath = path.resolve(__dirname, '..', 'dist');

(async () => {
  if (!secretId || !secretKey) {
    console.error('用法: node scripts/deploy-cloudbase.cjs <SecretId> <SecretKey>');
    console.error('   或: TCB_SECRET_ID=xxx TCB_SECRET_KEY=xxx node scripts/deploy-cloudbase.cjs');
    process.exit(1);
  }

  if (!fs.existsSync(distPath)) {
    console.error('dist 目录不存在，请先运行 npm run build');
    process.exit(1);
  }

  console.log(`环境: ${envId}`);
  console.log(`部署目录: ${distPath}`);

  const app = new CloudBase({ envId, secretId, secretKey });
  const hosting = app.hosting;

  console.log('正在上传...');
  const files = await hosting.upload({ localPath: distPath, cloudPath: '/' });

  console.log('配置 SPA 路由回退...');
  await hosting.setWebsiteDocument({
    indexDocument: 'index.html',
    errorDocument: 'index.html',
  });

  console.log(`部署完成！${files.length} 个文件`);
  console.log(`访问: https://${envId}.tcloudbaseapp.com`);
})().catch(err => {
  console.error('部署失败:', err.message);
  process.exit(1);
});
