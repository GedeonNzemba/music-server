import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, validateEnv } from './config/env';
import { logger, morganStream } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import musicRoutes from './routes/musicRoutes';
import adminRoutes from './routes/adminRoutes';
import path from 'path';

// Validate environment variables
if (!validateEnv()) {
  process.exit(1);
}

// Create Express app
const app = express();
const port = env.PORT;

// Apply middleware
app.use(helmet({ 
  contentSecurityPolicy: false // Disable CSP for admin interface
})); 
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: env.CORS.METHODS,
  credentials: true
}));
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('combined', { stream: morganStream })); // HTTP request logging

// Serve static admin UI files
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// API routes
app.use('/api/music', musicRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Music API Server',
    version: '1.0.0',
    endpoints: {
      music: '/api/music',
      admin: '/api/admin',
      adminUI: '/admin',
      health: '/health'
    }
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.info(`Server running in ${env.NODE_ENV} mode on port ${port}`);
  logger.info(`Admin interface available at http://localhost:${port}/admin`);
  logger.info(`API endpoints available at http://localhost:${port}/api`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});
