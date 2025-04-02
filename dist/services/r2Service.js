"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.r2Service = exports.R2Service = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
// Configure AWS SDK for Cloudflare R2
const s3 = new aws_sdk_1.default.S3({
    endpoint: env_1.env.R2.ENDPOINT,
    accessKeyId: env_1.env.R2.ACCESS_KEY_ID,
    secretAccessKey: env_1.env.R2.SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    region: env_1.env.R2.REGION,
});
class R2Service {
    constructor() {
        this.bucketName = env_1.env.R2.BUCKET_NAME;
        this.publicUrl = env_1.env.R2.PUBLIC_URL;
    }
    /**
     * List all albums in the R2 bucket
     */
    async listAlbums(limit, offset) {
        try {
            const data = await s3.listObjectsV2({
                Bucket: this.bucketName,
                Prefix: 'albums/',
                Delimiter: '/',
            }).promise();
            let albums = await Promise.all((data.CommonPrefixes || []).map(async (prefix) => {
                const albumName = prefix.Prefix.replace('albums/', '').replace('/', '');
                const albumPath = `albums/${albumName}/`;
                // Get the total number of music files in this album
                const albumFiles = await s3.listObjectsV2({
                    Bucket: this.bucketName,
                    Prefix: albumPath,
                }).promise();
                const musicCount = (albumFiles.Contents || []).filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav')).length;
                return {
                    name: albumName,
                    imageUrl: `${this.publicUrl}/albums/${encodeURIComponent(albumName)}/Album.jpg`,
                    totalMusic: musicCount
                };
            }));
            // Apply pagination
            if (offset && offset > 0) {
                albums = albums.slice(offset);
            }
            if (limit) {
                albums = albums.slice(0, limit);
            }
            return albums;
        }
        catch (error) {
            logger_1.logger.error('Error listing albums from R2', { error });
            throw error;
        }
    }
    /**
     * Get a specific album by name
     */
    async getAlbum(name, limit, offset) {
        try {
            const albumPath = `albums/${name}/`;
            // List all files in the album folder
            const data = await s3.listObjectsV2({
                Bucket: this.bucketName,
                Prefix: albumPath,
            }).promise();
            // Check if album exists
            if (!data.Contents || data.Contents.length === 0) {
                throw new Error('Album not found');
            }
            // Filter only music files
            let musicFiles = (data.Contents || [])
                .filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav'))
                .map(file => ({
                title: file.Key.replace(albumPath, '').replace(/\.(mp3|wav)$/i, ''),
                url: `${this.publicUrl}/${file.Key}`,
                key: file.Key,
                size: file.Size,
                lastModified: file.LastModified
            }));
            // Apply pagination
            if (offset && offset > 0) {
                musicFiles = musicFiles.slice(offset);
            }
            if (limit) {
                musicFiles = musicFiles.slice(0, limit);
            }
            return {
                name,
                imageUrl: `${this.publicUrl}/albums/${encodeURIComponent(name)}/Album.jpg`,
                totalMusic: (data.Contents || []).filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav')).length,
                musicFiles
            };
        }
        catch (error) {
            logger_1.logger.error(`Error getting album ${name} from R2`, { error });
            throw error;
        }
    }
    /**
     * List all songs across all albums
     */
    async listAllSongs(limit, offset, shuffle) {
        try {
            const albumPrefix = 'albums/';
            // Fetch all objects in the "albums" folder
            const data = await s3.listObjectsV2({
                Bucket: this.bucketName,
                Prefix: albumPrefix,
            }).promise();
            // Create a map to store album images
            const albumImages = {};
            (data.Contents || []).forEach(file => {
                const filePath = file.Key.replace(albumPrefix, '');
                const parts = filePath.split('/');
                // If the file is a .jpg, use it as the album image
                if (parts.length === 2 && filePath.endsWith('.jpg')) {
                    const albumName = parts[0];
                    if (!albumImages[albumName]) {
                        albumImages[albumName] = `${this.publicUrl}/${file.Key}`;
                    }
                }
            });
            // Filter only music files
            let allSongs = (data.Contents || [])
                .filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav'))
                .map(file => {
                const filePath = file.Key.replace(albumPrefix, '');
                const parts = filePath.split('/');
                const albumName = parts[0];
                const songTitle = parts[1].replace(/\.(mp3|wav)$/i, '');
                return {
                    title: songTitle,
                    album: albumName,
                    albumImage: albumImages[albumName] || null,
                    url: `${this.publicUrl}/${file.Key}`,
                    key: file.Key,
                    size: file.Size,
                    lastModified: file.LastModified
                };
            });
            // Shuffle if requested
            if (shuffle) {
                allSongs = allSongs.sort(() => Math.random() - 0.5);
            }
            // Apply pagination
            if (offset && offset > 0) {
                allSongs = allSongs.slice(offset);
            }
            if (limit) {
                allSongs = allSongs.slice(0, limit);
            }
            return {
                totalSongs: allSongs.length,
                songs: allSongs
            };
        }
        catch (error) {
            logger_1.logger.error('Error listing all songs from R2', { error });
            throw error;
        }
    }
    /**
     * Generate a streaming URL for a song
     */
    async getStreamingUrl(album, song, range) {
        try {
            const fileKey = `albums/${album}/${song}.mp3`;
            // Get metadata (needed for content length)
            const songData = await s3.headObject({
                Bucket: this.bucketName,
                Key: fileKey
            }).promise();
            const fileSize = songData.ContentLength || 0;
            if (!range) {
                throw new Error('Range header is required for streaming');
            }
            // Parse range header (e.g., "bytes=0-")
            const [start, end] = range.replace(/bytes=/, "").split("-").map(Number);
            const chunkEnd = end || Math.min(start + 10 * 1024 * 1024, fileSize - 1);
            const contentLength = chunkEnd - start + 1;
            // Stream file from R2
            const stream = s3.getObject({
                Bucket: this.bucketName,
                Key: fileKey,
                Range: `bytes=${start}-${chunkEnd}`
            }).createReadStream();
            return {
                stream,
                contentLength,
                contentRange: `bytes ${start}-${chunkEnd}/${fileSize}`,
                fileSize
            };
        }
        catch (error) {
            logger_1.logger.error(`Error streaming song ${song} from album ${album}`, { error });
            throw error;
        }
    }
    /**
     * Generate a download URL for a song
     */
    async getDownloadStream(album, song) {
        try {
            const fileKey = `albums/${album}/${song}.mp3`;
            // Fetch the file from R2
            const fileStream = s3.getObject({
                Bucket: this.bucketName,
                Key: fileKey
            }).createReadStream();
            return fileStream;
        }
        catch (error) {
            logger_1.logger.error(`Error downloading song ${song} from album ${album}`, { error });
            throw error;
        }
    }
    /**
     * Generate a signed URL for a song (for temporary access)
     */
    getSignedUrl(key, expiresIn = 3600) {
        return s3.getSignedUrl('getObject', {
            Bucket: this.bucketName,
            Key: key,
            Expires: expiresIn // URL expires in specified seconds (default: 1 hour)
        });
    }
    /**
     * List all objects in a directory
     */
    async listObjects(prefix, delimiter) {
        try {
            return await s3.listObjectsV2({
                Bucket: this.bucketName,
                Prefix: prefix,
                Delimiter: delimiter
            }).promise();
        }
        catch (error) {
            logger_1.logger.error(`Error listing objects with prefix ${prefix}`, { error });
            throw error;
        }
    }
    /**
     * Upload a file to R2
     */
    async uploadFile(key, body, contentType) {
        try {
            return await s3.upload({
                Bucket: this.bucketName,
                Key: key,
                Body: body,
                ContentType: contentType
            }).promise();
        }
        catch (error) {
            logger_1.logger.error(`Error uploading file ${key}`, { error });
            throw error;
        }
    }
    /**
     * Delete a file from R2
     */
    async deleteFile(key) {
        try {
            return await s3.deleteObject({
                Bucket: this.bucketName,
                Key: key
            }).promise();
        }
        catch (error) {
            logger_1.logger.error(`Error deleting file ${key}`, { error });
            throw error;
        }
    }
}
exports.R2Service = R2Service;
// Export a singleton instance
exports.r2Service = new R2Service();
//# sourceMappingURL=r2Service.js.map