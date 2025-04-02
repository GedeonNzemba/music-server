import { Request, Response, NextFunction } from 'express';
export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}
/**
 * Error handling middleware
 */
export declare const errorHandler: (err: AppError, _req: Request, res: Response, _next: NextFunction) => void;
/**
 * Not found middleware
 */
export declare const notFoundHandler: (req: Request, res: Response, _next: NextFunction) => void;
