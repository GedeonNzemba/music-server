"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
/**
 * Error handling middleware
 */
const errorHandler = (err, _req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const isOperational = err.isOperational || false;
    // Log error
    logger_1.logger.error(`${statusCode} - ${err.message}`, {
        stack: err.stack,
        isOperational
    });
    // Send error response
    res.status(statusCode).json({
        error: {
            message: err.message,
            // Only include stack trace in development
            ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
        }
    });
};
exports.errorHandler = errorHandler;
/**
 * Not found middleware
 */
const notFoundHandler = (req, res, _next) => {
    logger_1.logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: {
            message: `Route not found: ${req.method} ${req.originalUrl}`
        }
    });
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=errorHandler.js.map