"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from .env file
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
exports.env = {
    // Server configuration
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3009', 10),
    // Cloudflare R2 configuration
    R2: {
        ENDPOINT: process.env.END_POINT || '',
        ACCESS_KEY_ID: process.env.ACCESS_KEY_ID || '',
        SECRET_ACCESS_KEY: process.env.SECRET_ACCESS_KEY || '',
        BUCKET_NAME: process.env.BUCKET_NAME || 'saintshubappmusic',
        PUBLIC_URL: process.env.PUBLIC_URL || 'https://takemore.xyz',
        REGION: 'auto',
    },
    // CORS configuration
    CORS: {
        ORIGIN: process.env.CORS_ORIGIN || '*',
        METHODS: process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE',
    },
};
// Validate required environment variables
const validateEnv = () => {
    const requiredEnvVars = [
        'R2.ENDPOINT',
        'R2.ACCESS_KEY_ID',
        'R2.SECRET_ACCESS_KEY',
        'R2.BUCKET_NAME',
    ];
    const missingEnvVars = requiredEnvVars.filter(varPath => {
        const parts = varPath.split('.');
        let value = exports.env;
        for (const part of parts) {
            value = value[part];
            if (!value)
                return true;
        }
        return false;
    });
    if (missingEnvVars.length > 0) {
        console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        return false;
    }
    return true;
};
exports.validateEnv = validateEnv;
//# sourceMappingURL=env.js.map