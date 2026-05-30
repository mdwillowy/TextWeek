import app from './app.js';
import http from 'http';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { initSocketServer } from './socket/index.js';
import { startRetentionJob } from './jobs/retentionJob.js';
import { initMonitoring } from './utils/monitoring.js';

async function start() {
  try {
    initMonitoring();
    await connectDB();
    const server = http.createServer(app);
    initSocketServer(server);
    startRetentionJob();

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `Port ${env.port} is already in use. Stop the running backend process before starting a new one.`
        );
        process.exit(1);
      }

      console.error('HTTP server error:', err.message);
      process.exit(1);
    });

    server.listen(env.port, () => {
      console.log(`Server running on http://localhost:${env.port}`);
      console.log(`Allowed client origins: ${env.clientOrigins.join(', ')}`);
      console.log('Socket.IO server initialized');
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
