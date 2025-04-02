export declare const env: {
    NODE_ENV: string;
    PORT: number;
    R2: {
        ENDPOINT: string;
        ACCESS_KEY_ID: string;
        SECRET_ACCESS_KEY: string;
        BUCKET_NAME: string;
        PUBLIC_URL: string;
        REGION: string;
    };
    CORS: {
        ORIGIN: string;
        METHODS: string;
    };
};
export declare const validateEnv: () => boolean;
