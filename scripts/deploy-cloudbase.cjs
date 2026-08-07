/**
 * CloudBase 静态托管部署脚本
 * 使用 tcb hosting deploy 命令行部署
 * 用法: node scripts/deploy-cloudbase.cjs <secretId> <secretKey>
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envId = 'fanxiaobao-d9gpf87uvf3323ae7';
const secretId = process.env.TCB_SECRET_ID || process.argv[2];
const secretKey = process.env.TCB_SECRET_KEY || process.argv[3];
const distPath = path.resolve(__dirname, '..', 'dist');

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

try {
  // 登录
  console.log('登录 CloudBase...');
  execSync(
    `npx tcb login --apiKeyId "${secretId}" --apiKey "${secretKey}"`,
    { stdio: 'inherit', timeout: 30000 }
  );

  // 部署到静态托管（低并发避免网络超时）
  console.log('正在上传...');
  execSync(
    `npx tcb hosting deploy "${distPath}" / -e ${envId} --concurrency 1 --retry-count 10 --retry-interval 5000`,
    { stdio: 'inherit', timeout: 600000 }
  );

  console.log('');
  console.log('部署完成！');
  console.log(`访问: https://${envId}.tcloudbaseapp.com`);
} catch (err) {
  console.error('部署失败:', err.message);
  process.exit(1);
}
