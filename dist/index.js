"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const musicRoutes_1 = __importDefault(require("./routes/musicRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const path_1 = __importDefault(require("path"));
// Validate environment variables
if (!(0, env_1.validateEnv)()) {
    process.exit(1);
}
// Create Express app
const app = (0, express_1.default)();
const port = env_1.env.PORT;
// Apply middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false // Disable CSP for admin interface
}));
app.use((0, cors_1.default)({
    origin: '*', // Allow all origins for development
    methods: env_1.env.CORS.METHODS,
    credentials: true
}));
app.use(express_1.default.json()); // Parse JSON bodies
app.use(express_1.default.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use((0, morgan_1.default)('combined', { stream: logger_1.morganStream })); // HTTP request logging
// Serve static admin UI files
app.use('/admin', express_1.default.static(path_1.default.join(__dirname, '../admin')));
// API routes
app.use('/api/music', musicRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
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
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
// Start server
app.listen(port, () => {
    logger_1.logger.info(`Server running in ${env_1.env.NODE_ENV} mode on port ${port}`);
    logger_1.logger.info(`Admin interface available at http://localhost:${port}/admin`);
    logger_1.logger.info(`API endpoints available at http://localhost:${port}/api`);
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception', { error });
    process.exit(1);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection', { reason, promise });
    process.exit(1);
});
//# sourceMappingURL=index.js.map