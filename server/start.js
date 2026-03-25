// Production startup script for Docker
// Runs only Next.js server for demo deployment

const { spawn } = require('child_process');
const path = require('path');

console.log('WebSocket server is disabled in demo startup.');

// Next.js server (standalone)
const nextServer = spawn('node', [path.join(__dirname, '..', 'server.js')], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '0.0.0.0', PORT: '3000' }
});

// Handle shutdown
process.on('SIGTERM', () => {
  nextServer.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  nextServer.kill('SIGINT');
  process.exit(0);
});

nextServer.on('exit', (code) => {
  console.error(`Next.js server exited with code ${code}`);
  process.exit(code || 1);
});
