// Production startup script for Docker
// Runs both Next.js server and WebSocket server

const { spawn } = require('child_process');
const path = require('path');

// WebSocket server (using tsx to run TypeScript)
const wsServer = spawn('npx', ['tsx', path.join(__dirname, 'websocket-server.ts')], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
  shell: true
});

// Next.js server (standalone)
const nextServer = spawn('node', [path.join(__dirname, '..', 'server.js')], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, NODE_ENV: 'production' }
});

// Handle shutdown
process.on('SIGTERM', () => {
  wsServer.kill('SIGTERM');
  nextServer.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  wsServer.kill('SIGINT');
  nextServer.kill('SIGINT');
  process.exit(0);
});

wsServer.on('exit', (code) => {
  console.error(`WebSocket server exited with code ${code}`);
  nextServer.kill();
  process.exit(code || 1);
});

nextServer.on('exit', (code) => {
  console.error(`Next.js server exited with code ${code}`);
  wsServer.kill();
  process.exit(code || 1);
});
