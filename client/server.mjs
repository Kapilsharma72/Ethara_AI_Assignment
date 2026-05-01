import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// When run from dist/ (Railway), assets are in the same directory.
// When run from client/ (local), assets are in dist/ subdirectory.
const isDist = __dirname.endsWith('dist') || __dirname.endsWith('dist/');
const DIST = isDist ? __dirname : path.join(__dirname, 'dist');

const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function serveIndex(res) {
  const index = path.join(DIST, 'index.html');
  fs.readFile(index, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(DIST, path.normalize(urlPath));
  const ext = path.extname(filePath).toLowerCase();

  if (!ext) { serveIndex(res); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { serveIndex(res); return; }
    const isHashed = /[.\-][0-9a-f]{8,}\.[a-z]+$/i.test(path.basename(filePath));
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': isHashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`[client] Serving from: ${DIST}`);
  console.log(`[client] Listening on port ${PORT}`);
});
