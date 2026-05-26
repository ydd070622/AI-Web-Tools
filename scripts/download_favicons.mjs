import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const fetch = (url) => new Promise((resolve, reject) => {
  const mod = url.startsWith('https') ? https : http;
  const req = mod.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let data = [];
    res.on('data', c => data.push(c));
    res.on('end', () => {
      const buf = Buffer.concat(data);
      resolve({ status: res.statusCode, buf, ext: res.headers['content-type']?.includes('png') ? 'png' : 'ico' });
    });
  });
  req.on('error', reject);
  req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
});

const outDir = path.resolve('E:/04-AI_tools/03-projects/03-AI_Tools/public/favicons');
fs.mkdirSync(outDir, { recursive: true });

const sites = [
  { name: 'liblib', url: 'https://www.liblib.tv/favicon.ico' },
  { name: 'runninghub', url: 'https://www.runninghub.cn/favicon.ico' },
  { name: 'tapnow', url: 'https://fe-assets.tapnow.top/2fdb1fbe7772d26a6c0629e6bc5976eb68d0df1c/assets/favicons/apple-touch-icon.png' },
];

for (const site of sites) {
  try {
    const r = await fetch(site.url);
    const ext = site.url.endsWith('.png') ? 'png' : 'ico';
    const fp = path.join(outDir, `${site.name}.${ext}`);
    fs.writeFileSync(fp, r.buf);
    console.log(`${site.name}: ${r.status} -> ${fp} (${r.buf.length}B)`);
  } catch (e) {
    console.error(`${site.name}: FAILED - ${e.message}`);
  }
}
