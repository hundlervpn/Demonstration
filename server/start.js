// Production startup script for Docker
// Runs Next.js server and optionally WebSocket server

const { spawn } = require('child_process');
const path = require('path');

const enableWsServer = process.env.ENABLE_WS_SERVER === 'true';
let wsServer = null;

if (enableWsServer) {
  wsServer = spawn('npx', ['tsx', path.join(__dirname, 'websocket-server.ts')], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
    shell: true
  });
} else {
  console.log('WebSocket server is disabled (set ENABLE_WS_SERVER=true to enable).');
}

// Next.js server (standalone)
const nextServer = spawn('node', [path.join(__dirname, '..', 'server.js')], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, NODE_ENV: 'production' }
});

// Handle shutdown
process.on('SIGTERM', () => {
  if (wsServer) wsServer.kill('SIGTERM');
  nextServer.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  if (wsServer) wsServer.kill('SIGINT');
  nextServer.kill('SIGINT');
  process.exit(0);
});

if (wsServer) {
  wsServer.on('exit', (code) => {
    console.error(`WebSocket server exited with code ${code}`);
    nextServer.kill();
    process.exit(code || 1);
  });
}

nextServer.on('exit', (code) => {
  console.error(`Next.js server exited with code ${code}`);
  if (wsServer) wsServer.kill();
  process.exit(code || 1);
});
