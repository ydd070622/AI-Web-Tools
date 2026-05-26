import https from 'https';
import http from 'http';

const fetch = (url) => new Promise((resolve) => {
  const mod = url.startsWith('https') ? https : http;
  const req = mod.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let data = [];
    res.on('data', c => data.push(c));
    res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], data: Buffer.concat(data).slice(0,3000).toString() }));
  });
  req.on('error', (e) => resolve({ error: e.message }));
  req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
});

(async () => {
  // Direct favicon.ico check
  for (const u of ['https://www.liblib.tv/favicon.ico','https://www.runninghub.cn/favicon.ico','https://app.tapnow.ai/favicon.ico']) {
    const r = await fetch(u);
    console.log(u.split('/')[2].padEnd(25), JSON.stringify(r).slice(0,100));
  }

  console.log('\n--- Check HTML for favicon links ---');
  for (const u of ['https://www.runninghub.cn','https://app.tapnow.ai','https://www.liblib.tv']) {
    const r = await fetch(u);
    console.log('\n' + u);
    if (r.error) { console.log('ERROR:', r.error); continue; }
    const m = r.data?.match(/<link[^>]*rel=["']?(icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']?([^"'>\s]+)/i);
    if (m) console.log('  favicon:', m[2]);
    else console.log('  no favicon link');
  }
})();
