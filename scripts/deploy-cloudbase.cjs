/**
 * CloudBase 静态托管部署脚本
 * 使用 COS SDK + 全球加速域名，逐个上传避免超时
 * 用法: node scripts/deploy-cloudbase.cjs <secretId> <secretKey>
 */
const COS = require('cos-nodejs-sdk-v5');
const path = require('path');
const fs = require('fs');

const envId = 'fanxiaobao-d9gpf87uvf3323ae7';
const secretId = process.env.TCB_SECRET_ID || process.argv[2];
const secretKey = process.env.TCB_SECRET_KEY || process.argv[3];
const distPath = path.resolve(__dirname, '..', 'dist');

if (!secretId || !secretKey) {
  console.error('用法: node scripts/deploy-cloudbase.cjs <SecretId> <SecretKey>');
  process.exit(1);
}

if (!fs.existsSync(distPath)) {
  console.error('dist 目录不存在，请先运行 npm run build');
  process.exit(1);
}

console.log(`环境: ${envId}`);
console.log(`部署目录: ${distPath}`);

// CloudBase 静态托管 bucket 命名规则: envId-appId
// 使用全球加速域名避免海外超时
const bucket = `${envId}-1253703546`;
const region = 'ap-shanghai';

const cos = new COS({
  SecretId: secretId,
  SecretKey: secretKey,
  Timeout: 300000, // 5分钟超时
});

function walkDir(dir, fileList = [], basePath = dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === '.DS_Store') continue;
    const fp = path.join(dir, file);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      walkDir(fp, fileList, basePath);
    } else {
      fileList.push({
        localPath: fp,
        cloudPath: fp.replace(basePath, '').replace(/^\/+/, ''),
        size: stat.size,
      });
    }
  }
  return fileList;
}

function getContentType(fp) {
  const ext = path.extname(fp).toLowerCase();
  const m = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };
  return m[ext] || 'application/octet-stream';
}

async function uploadFile(key, localPath, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        cos.putObject({
          Bucket: bucket,
          Region: region,
          Key: key,
          Body: fs.createReadStream(localPath),
          ContentType: getContentType(key),
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      return true;
    } catch (err) {
      if (attempt < retries) {
        console.log(`    重试 ${attempt + 1}/${retries}...`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.error(`    失败: ${err.message}`);
        return false;
      }
    }
  }
  return false;
}

async function deploy() {
  const files = walkDir(distPath);
  console.log(`共 ${files.length} 个文件，使用全球加速上传`);

  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    console.log(`[${i + 1}/${files.length}] ${f.cloudPath} (${(f.size / 1024).toFixed(1)}KB)`);
    if (await uploadFile(f.cloudPath, f.localPath)) {
      ok++;
    }
  }

  console.log(`\n${ok}/${files.length} 个文件上传成功`);

  // 配置 SPA 路由
  console.log('配置 SPA 路由回退...');
  try {
    await new Promise((resolve, reject) => {
      cos.putBucketWebsite({
        Bucket: bucket,
        Region: region,
        WebsiteConfiguration: {
          IndexDocument: { Suffix: 'index.html' },
          ErrorDocument: { Key: 'index.html' },
        },
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    console.log('SPA 路由配置成功');
  } catch (err) {
    console.error('SPA路由配置失败:', err.message);
  }

  if (ok < files.length) {
    console.error('部分文件上传失败！');
    process.exit(1);
  }

  console.log(`\n部署完成！访问: https://${envId}.tcloudbaseapp.com`);
}

deploy().catch(err => {
  console.error('部署失败:', err.message);
  process.exit(1);
});
