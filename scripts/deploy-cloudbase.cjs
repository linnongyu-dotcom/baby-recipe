/**
 * CloudBase 静态托管部署脚本
 * 使用 @cloudbase/manager-node 获取 bucket 信息，COS SDK 上传
 */
const CloudBase = require('@cloudbase/manager-node');
const COS = require('cos-nodejs-sdk-v5');
const path = require('path');
const fs = require('fs');

const envId = 'fanxiaobao-d9gpf87uvf3323ae7';
const secretId = process.env.TCB_SECRET_ID || process.argv[2];
const secretKey = process.env.TCB_SECRET_KEY || process.argv[3];
const distPath = path.resolve(__dirname, '..', 'dist');

if (!secretId || !secretKey) {
  console.error('用法: TCB_SECRET_ID=xxx TCB_SECRET_KEY=xxx node scripts/deploy-cloudbase.cjs');
  process.exit(1);
}

if (!fs.existsSync(distPath)) {
  console.error('dist 目录不存在，请先运行 npm run build');
  process.exit(1);
}

console.log(`环境: ${envId}`);

function walkDir(dir, fileList = [], basePath = dir) {
  for (const file of fs.readdirSync(dir)) {
    if (file === '.DS_Store') continue;
    const fp = path.join(dir, file);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) walkDir(fp, fileList, basePath);
    else fileList.push({ localPath: fp, cloudPath: fp.replace(basePath, '').replace(/^\//, ''), size: stat.size });
  }
  return fileList;
}

function getContentType(fp) {
  const m = { '.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'application/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf' };
  return m[path.extname(fp).toLowerCase()] || 'application/octet-stream';
}

async function deploy() {
  // 1. 登录并获取 hosting bucket 信息
  console.log('获取 hosting 信息...');
  const app = new CloudBase({ envId, secretId, secretKey });
  const hosting = app.hosting;
  const info = await hosting.getInfo();
  if (!info || !info.length) throw new Error('静态网站服务未开启');
  const { Bucket, Regoin } = info[0];
  console.log(`Bucket: ${Bucket}, Region: ${Regoin}`);

  // 2. 使用 COS SDK 逐个上传
  const cos = new COS({ SecretId: secretId, SecretKey: secretKey, Timeout: 300000 });
  const files = walkDir(distPath);
  console.log(`共 ${files.length} 个文件`);

  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    console.log(`[${i+1}/${files.length}] ${f.cloudPath} (${(f.size/1024).toFixed(1)}KB)`);
    let uploaded = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await new Promise((resolve, reject) => {
          cos.putObject({ Bucket, Region: Regoin, Key: f.cloudPath, Body: fs.createReadStream(f.localPath), ContentType: getContentType(f.cloudPath) }, (e,d) => e ? reject(e) : resolve(d));
        });
        ok++;
        uploaded = true;
        break;
      } catch (e) {
        if (attempt < 3) { console.log(`  重试 ${attempt+1}/3...`); await new Promise(r => setTimeout(r, 3000)); }
        else console.error(`  失败: ${e.message}`);
      }
    }
  }

  console.log(`\n${ok}/${files.length} 上传成功`);

  // 3. SPA 路由
  console.log('配置 SPA 路由...');
  try {
    await hosting.setWebsiteDocument({ indexDocument: 'index.html', errorDocument: 'index.html' });
    console.log('SPA 路由配置成功');
  } catch(e) { console.error('SPA路由失败:', e.message); }

  if (ok < files.length) { console.error('部分失败！'); process.exit(1); }
  console.log(`\n部署完成！https://${envId}.tcloudbaseapp.com`);
}

deploy().catch(e => { console.error('部署失败:', e.message); process.exit(1); });
