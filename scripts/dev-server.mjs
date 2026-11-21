import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.cube': 'text/plain; charset=utf-8'
};

const EN_REWRITES = {
  '/en': 'index.html',
  '/en/pricing': 'bang-gia/index.html',
  '/en/download': 'tai-xuong/index.html',
  '/en/about': 'gioi-thieu/index.html',
  '/en/policies': 'chinh-sach/index.html',
  '/en/policies/privacy': 'chinh-sach/bao-mat/index.html',
  '/en/policies/terms': 'chinh-sach/dieu-khoan/index.html',
  '/en/policies/cookies': 'chinh-sach/cookie/index.html',
  '/en/policies/refunds': 'chinh-sach/thanh-toan-hoan-tien/index.html',
  '/en/policies/licenses': 'chinh-sach/giay-phep/index.html'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const cleanPathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  let reqPath = EN_REWRITES[cleanPathname] || decodeURIComponent(url.pathname).replace(/^\/+/, '');
  let target = path.join(rootDir, reqPath);

  if (!target.startsWith(rootDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
  } else if (!fs.existsSync(target) && fs.existsSync(target + '.html')) {
    target = target + '.html';
  } else if (!fs.existsSync(target) && fs.existsSync(path.join(target, 'index.html'))) {
    target = path.join(target, 'index.html');
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    const notFound = path.join(rootDir, '404.html');
    if (fs.existsSync(notFound)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(notFound).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`DEVSTU showcase running at http://127.0.0.1:${port}`);
});
