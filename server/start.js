#!/usr/bin/env node
/**
 * Production startup script.
 * Runs database migrations then starts the server.
 * Works whether executed from the server/ directory or the repo root.
 */
const { execSync } = require('child_process');
const path = require('path');

// Resolve the server directory regardless of where this script is called from
const serverDir = __dirname;

console.log('[start] Server directory:', serverDir);
console.log('[start] Running migrations...');

try {
  execSync(`node ${path.join(serverDir, 'dist', 'db', 'migrate.js')}`, {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('[start] Migrations complete.');
} catch (err) {
  console.error('[start] Migration failed:', err.message);
  process.exit(1);
}

console.log('[start] Starting server...');
require(path.join(serverDir, 'dist', 'server.js'));
