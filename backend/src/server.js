/**
 * Local Development Server
 * University of Ilorin Carpooling Platform
 *
 * Starts the Express server for local development.
 * In production, the app is served via AWS Lambda.
 *
 * Path: src/server.js
 *
 * @module server
 */

require('dotenv').config();
const app = require('./app');
const { logger } = require('./shared/utils/logger');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`🚗 PSRide API server running`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    url: `http://localhost:${PORT}/api/v1/health`,
  });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
