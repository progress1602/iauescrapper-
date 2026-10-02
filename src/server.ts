import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { scraperScheduler } from './scrapers/jobs/scraperScheduler';

let server: http.Server | null = null;

async function bootstrap(): Promise<void> {
  try {
    console.log('Connecting to database...');
    await connectDatabase();

    // Start background scraper scheduler if enabled
    scraperScheduler.start();

    server = http.createServer(app);
    server.listen(env.PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 IAUE Student Hub Backend listening on port ${env.PORT}`);
      console.log(`📚 Swagger Playground : http://localhost:${env.PORT}/playground`);
      console.log(`📖 Scalar API Docs     : http://localhost:${env.PORT}/scalar`);
      console.log(`⚙️  OpenAPI Spec JSON  : http://localhost:${env.PORT}/openapi.json`);
      console.log(`🏥 Scraper Health      : http://localhost:${env.PORT}/api/v1/admin/scrapers/health`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to bootstrap IAUE Student Hub server:', err);
    process.exit(1);
  }
}

// Graceful Shutdown Handlers for Render / Container Deployments
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);

  try {
    // 1. Stop background scheduler
    scraperScheduler.stop();

    // 2. Stop accepting new HTTP requests
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) return reject(err);
          console.log('HTTP server closed cleanly.');
          resolve();
        });
      });
    }

    // 3. Disconnect MongoDB
    await disconnectDatabase();

    console.log('Graceful shutdown completed successfully. Exiting.');
    process.exit(0);
  } catch (err) {
    console.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

bootstrap();
