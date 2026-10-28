import http from 'node:http';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

const app = createApp({
  publicDir: config.publicDir,
  contentFile: config.contentFile,
  messagesFile: config.messagesFile,
  messagesMaxBytes: config.messagesMaxBytes,
  rateLimit: config.rateLimit,
  trustProxy: config.trustProxy,
});

const server = http.createServer(app);
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Set PORT to another value, e.g. PORT=3001 npm start`);
  } else {
    console.error(`Server error: ${err.message}`);
  }
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  const { port } = server.address();
  const host = config.host.includes(':') ? `[${config.host}]` : config.host;
  console.log(`Portfolio running at http://${host}:${port}`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) {
    console.log('Forcing exit.');
    process.exit(1);
  }
  shuttingDown = true;
  console.log(`\n${signal} received, shutting down...`);
  app.close();
  server.close((err) => {
    if (err) console.error(`Error while closing: ${err.message}`);
    process.exit(err ? 1 : 0);
  });
  server.closeIdleConnections();
  // Give in-flight requests a moment, then drop whatever is left.
  const timer = setTimeout(() => {
    server.closeAllConnections();
  }, 5000);
  timer.unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
