/**
 * Minimal static file server for the React SPA.
 * Serves files from ./dist/ with correct Cache-Control headers:
 *   - Hashed assets (e.g. main.a3f9c1.js): immutable, 1-year cache
 *   - index.html: no-cache so the browser always fetches the latest entry point
 * Falls back to index.html for any path that doesn't match a file (SPA routing).
 *
 * Uses only Node.js built-in modules — no external dependencies required.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 8080;

/** Detect whether a filename contains a content hash segment (e.g. main.a3f9c1.js) */
function isHashedAsset(filename) {
  // Vite produces filenames like: name-[hash].ext or name.[hash].ext
  // A hash segment is 8+ hex characters surrounded by dots or hyphens
  return /[.\-][0-9a-f]{8,}\.[a-z]+$/i.test(filename);
}

/** Return the MIME type for a given file extension */
function getMimeType(ext) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf':  'font/ttf',
    '.eot':  'application/vnd.ms-fontobject',
    '.webp': 'image/webp',
    '.txt':  'text/plain; charset=utf-8',
  };
  return types[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  // Strip query string and decode URI
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  // Prevent directory traversal
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  // Resolve the file to serve
  function serveFile(targetPath) {
    fs.stat(targetPath, (err, stats) => {
      if (err || !stats.isFile()) {
        // SPA fallback: serve index.html for any unmatched path
        const indexPath = path.join(DIST_DIR, 'index.html');
        fs.readFile(indexPath, (readErr, data) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(data);
        });
        return;
      }

      const ext = path.extname(targetPath).toLowerCase();
      const filename = path.basename(targetPath);
      const isIndex = filename === 'index.html';
      const cacheControl = isIndex
        ? 'no-cache'
        : isHashedAsset(filename)
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600'; // short cache for un-hashed static assets

      fs.readFile(targetPath, (readErr, data) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }
        res.writeHead(200, {
          'Content-Type': getMimeType(ext),
          'Cache-Control': cacheControl,
          'Content-Length': data.length,
        });
        res.end(data);
      });
    });
  }

  // If the path ends with '/' or has no extension, try index.html inside that dir first,
  // then fall back to SPA routing.
  if (urlPath.endsWith('/') || !path.extname(urlPath)) {
    const dirIndex = path.join(filePath, 'index.html');
    fs.stat(dirIndex, (err, stats) => {
      if (!err && stats.isFile()) {
        serveFile(dirIndex);
      } else {
        serveFile(filePath); // will trigger SPA fallback if not found
      }
    });
  } else {
    serveFile(filePath);
  }
});

server.listen(PORT, () => {
  console.log(`Static file server listening on port ${PORT}`);
  console.log(`Serving files from: ${DIST_DIR}`);
});
