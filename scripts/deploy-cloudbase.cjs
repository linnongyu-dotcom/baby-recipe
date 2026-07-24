/**
 * CloudBase 静态托管部署脚本
 * 使用 CloudBase Manager SDK 上传 dist 目录
 */
const { CloudBase } = require('@cloudbase/manager-node');
const path = require('path');
const fs = require('fs');

const envId = process.env.TCB_ENV_ID || 'fanxiaobao-d9gpf87uvf3323ae7';
const secretId = process.env.TCB_SECRET_ID;
const secretKey = process.env.TCB_SECRET_KEY;
const distPath = path.resolve(__dirname, '..', 'dist');

if (!secretId || !secretKey) {
  console.error('错误：请设置 TCB_SECRET_ID 和 TCB_SECRET_KEY 环境变量');
  process.exit(1);
}

if (!fs.existsSync(distPath)) {
  console.error('错误：dist 目录不存在，请先运行 npm run build');
  process.exit(1);
}

async function deploy() {
  console.log(`环境 ID: ${envId}`);
  console.log(`部署目录: ${distPath}`);

  const app = new CloudBase({
    envId,
    secretId,
    secretKey,
  });

  // 获取静态托管服务
  const hosting = app.hosting;

  // 上传文件
  console.log('正在上传文件...');
  const files = await hosting.upload({
    localPath: distPath,
    cloudPath: '/',
    ignore: ['.DS_Store'],
  });

  console.log(`部署完成！共上传 ${files.length} 个文件`);

  // 输出访问地址
  const domains = await hosting.getDomains();
  if (domains && domains.length > 0) {
    console.log(`访问地址: https://${domains[0]}`);
  } else {
    console.log(`访问地址: https://${envId}.tcloudbaseapp.com`);
  }
}

deploy().catch((err) => {
  console.error('部署失败:', err.message);
  process.exit(1);
});
