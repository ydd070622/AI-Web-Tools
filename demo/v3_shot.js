const http = require('http');
const fs = require('fs');
const path = require('path');

const HTML_FILE = 'C:\\Users\\27893\\Desktop\\客户管理中心.html';
const PORT = 8892;
const DEMO_DIR = __dirname;

// Minimal HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(HTML_FILE).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`Server: http://127.0.0.1:${PORT}`);

  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });

  const pages = [
    { name: '01-workbench', nav: null, desc: '工作台' },
    { name: '02-customers-table', nav: 'customers', desc: '客户管理-列表视图' },
    { name: '03-customers-kanban', nav: 'customers', desc: '客户管理-看板视图' },
    { name: '04-leadpool', nav: 'leadpool', desc: '线索池' },
    { name: '05-contracts', nav: 'contracts', desc: '合同管理' },
    { name: '06-dashboard', nav: 'dashboard', desc: '数据看板' },
    { name: '07-notes', nav: 'notes', desc: '笔记管理' },
  ];

  for (const pageInfo of pages) {
    console.log(`Screenshot: ${pageInfo.desc}...`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for React to render
    await page.waitForSelector('.sidebar', { timeout: 10000 });
    await page.waitForTimeout(800);

    // Navigate to the right page
    if (pageInfo.nav) {
      // Click sidebar item by text
      const navLabels = {
        workbench: '工作台',
        customers: '客户管理',
        leadpool: '线索池',
        contracts: '合同管理',
        dashboard: '数据看板',
        notes: '笔记管理',
      };
      const label = navLabels[pageInfo.nav];
      await page.click(`.sidebar-item:has-text("${label}")`);
      await page.waitForTimeout(600);

      // For customers page, toggle to kanban if needed
      if (pageInfo.name === '03-customers-kanban') {
        await page.click('.view-btn:has-text("看板")');
        await page.waitForTimeout(400);
      }
    }

    const filePath = path.join(DEMO_DIR, `v3-${pageInfo.name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`  -> ${filePath}`);

    await context.close();
  }

  await browser.close();
  server.close();
  console.log('Done.');
  process.exit(0);
});
