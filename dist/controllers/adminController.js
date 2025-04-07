"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const r2Service_1 = require("../services/r2Service");
const logger_1 = require("../utils/logger");
class AdminController {
    /**
     * List all objects in the R2 bucket (for admin interface)
     */
    async listAllObjects(req, res) {
        try {
            const prefix = req.query.prefix || '';
            const delimiter = req.query.delimiter;
            logger_1.logger.info(`Listing objects with prefix: "${prefix}" and delimiter: "${delimiter}"`);
            const objects = await r2Service_1.r2Service.listObjects(prefix, delimiter);
            logger_1.logger.info(`Found ${objects.Contents?.length || 0} objects and ${objects.CommonPrefixes?.length || 0} common prefixes`);
            res.json({
                prefix,
                commonPrefixes: objects.CommonPrefixes || [],
                contents: objects.Contents || []
            });
        }
        catch (error) {
            logger_1.logger.error('Error listing objects', { error });
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * Delete a file from R2
     */
    async deleteFile(req, res) {
        try {
            const { key } = req.params;
            if (!key) {
                res.status(400).json({ error: 'Key parameter is required' });
                return;
            }
            logger_1.logger.info(`Deleting file with key: ${key}`);
            await r2Service_1.r2Service.deleteFile(key);
            res.json({ message: 'File deleted successfully', key });
        }
        catch (error) {
            logger_1.logger.error(`Error deleting file ${req.params.key}`, { error });
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * Get signed URL for a file (for admin preview)
     */
    async getSignedUrl(req, res) {
        try {
            const { key } = req.params;
            if (!key) {
                res.status(400).json({ error: 'Key parameter is required' });
                return;
            }
            const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn, 10) : 3600;
            logger_1.logger.info(`Generating signed URL for key: ${key} with expiration: ${expiresIn} seconds`);
            const url = r2Service_1.r2Service.getSignedUrl(key, expiresIn);
            res.json({ url });
        }
        catch (error) {
            logger_1.logger.error(`Error generating signed URL for ${req.params.key}`, { error });
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * Get metadata for a file in R2
     */
    async getMetadata(req, res) {
        try {
            const { key } = req.params;
            if (!key) {
                res.status(400).json({ error: 'Key parameter is required' });
                return;
            }
            logger_1.logger.info(`Getting metadata for file: ${key}`);
            const metadata = await r2Service_1.r2Service.getMetadata(key);
            res.json({ metadata });
        }
        catch (error) {
            logger_1.logger.error(`Error getting metadata for ${req.params.key}`, { error });
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * Update metadata for a file in R2
     */
    async updateMetadata(req, res) {
        try {
            const { key } = req.params;
            const metadata = req.body;
            if (!key) {
                res.status(400).json({ error: 'Key parameter is required' });
                return;
            }
            if (!metadata || typeof metadata !== 'object') {
                res.status(400).json({ error: 'Metadata object is required' });
                return;
            }
            logger_1.logger.info(`Updating metadata for file: ${key}`, { metadata });
            await r2Service_1.r2Service.updateMetadata(key, metadata);
            // Get the updated metadata to return to the client
            const updatedMetadata = await r2Service_1.r2Service.getMetadata(key);
            res.json({
                message: 'Metadata updated successfully',
                key,
                metadata: updatedMetadata
            });
        }
        catch (error) {
            logger_1.logger.error(`Error updating metadata for ${req.params.key}`, { error });
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * Apply metadata to all songs in an album
     */
    async applyMetadataToAlbum(req, res) {
        try {
            const { albumName } = req.params;
            const requestBody = req.body;
            if (!albumName) {
                res.status(400).json({ error: 'Album name parameter is required' });
                return;
            }
            if (!requestBody || typeof requestBody !== 'object') {
                res.status(400).json({ error: 'Request body is required' });
                return;
            }
            // Extract the metadata from the request body
            // The frontend sends { metadata: { ... } } but we just need the inner object
            const metadata = requestBody.metadata && typeof requestBody.metadata === 'object'
                ? requestBody.metadata
                : requestBody;
            logger_1.logger.info(`Applying metadata to all songs in album: ${albumName}`, { extractedMetadata: metadata });
            // List all objects in the album folder
            const albumPrefix = `albums/${albumName}/`;
            const objects = await r2Service_1.r2Service.listObjects(albumPrefix);
            if (!objects.Contents || objects.Contents.length === 0) {
                res.status(404).json({ error: `No files found in album: ${albumName}` });
                return;
            }
            // Filter for MP3 files only
            const mp3Files = objects.Contents.filter(obj => {
                const key = obj.Key || '';
                return key.toLowerCase().endsWith('.mp3');
            });
            if (mp3Files.length === 0) {
                res.status(404).json({ error: `No MP3 files found in album: ${albumName}` });
                return;
            }
            // Update the album.json file with the new metadata
            const albumJsonKey = `albums/${albumName}/album.json`;
            try {
                // Try to get existing album.json content
                let existingAlbumData = {};
                try {
                    const albumJsonObj = await r2Service_1.r2Service.getObject(albumJsonKey);
                    if (albumJsonObj && albumJsonObj.Body) {
                        // Parse the JSON content
                        const bodyStream = albumJsonObj.Body;
                        const chunks = [];
                        for await (const chunk of bodyStream) {
                            chunks.push(Buffer.from(chunk));
                        }
                        const albumJsonContent = Buffer.concat(chunks).toString('utf8');
                        existingAlbumData = JSON.parse(albumJsonContent);
                        logger_1.logger.info(`Retrieved existing album.json content for ${albumName}`, { existingAlbumData });
                    }
                }
                catch (jsonErr) {
                    logger_1.logger.warn(`Could not read album.json content for ${albumName}`, { error: jsonErr });
                    // Try to get metadata from the album.json file itself as fallback
                    try {
                        existingAlbumData = await r2Service_1.r2Service.getMetadata(albumJsonKey) || {};
                        logger_1.logger.info(`Retrieved existing album.json metadata for ${albumName}`, { existingAlbumData });
                    }
                    catch (metaErr) {
                        logger_1.logger.warn(`No existing album metadata found for ${albumName}`, { error: metaErr });
                    }
                }
                // Clean up the metadata to prevent nested objects
                const cleanMetadata = { ...metadata };
                // Remove any nested metadata object to prevent recursion
                if (cleanMetadata.metadata) {
                    logger_1.logger.warn(`Found nested metadata object, flattening structure`);
                    delete cleanMetadata.metadata;
                }
                // Merge existing data with new metadata, ensuring new values override old ones
                // Make sure we don't have duplicate metadata fields
                const updatedAlbumJson = JSON.stringify({
                    albumName,
                    ...existingAlbumData,
                    ...cleanMetadata
                }, null, 2);
                // Update the album.json file
                logger_1.logger.info(`Updating album.json for ${albumName} with new content`, { cleanMetadata });
                await r2Service_1.r2Service.uploadFile(albumJsonKey, updatedAlbumJson, 'application/json');
                await r2Service_1.r2Service.updateMetadata(albumJsonKey, cleanMetadata);
            }
            catch (err) {
                // If album.json doesn't exist, create it
                // Clean up the metadata to prevent nested objects
                const cleanMetadata = { ...metadata };
                // Remove any nested metadata object to prevent recursion
                if (cleanMetadata.metadata) {
                    logger_1.logger.warn(`Found nested metadata object, flattening structure`);
                    delete cleanMetadata.metadata;
                }
                logger_1.logger.info(`Creating new album.json for ${albumName}`, { cleanMetadata });
                const albumJson = JSON.stringify({ albumName, ...cleanMetadata }, null, 2);
                await r2Service_1.r2Service.uploadFile(albumJsonKey, albumJson, 'application/json');
                await r2Service_1.r2Service.updateMetadata(albumJsonKey, cleanMetadata);
            }
            // Apply metadata to all MP3 files with better error handling
            const mp3Keys = mp3Files.map(file => file.Key || '');
            const updateResults = [];
            // Clean up the metadata to prevent nested objects
            const mp3Metadata = { ...metadata };
            // Remove any nested metadata object to prevent recursion
            if (mp3Metadata.metadata) {
                logger_1.logger.warn(`Found nested metadata object, flattening structure for MP3 files`);
                delete mp3Metadata.metadata;
            }
            logger_1.logger.info(`Starting metadata update for ${mp3Keys.length} files in album: ${albumName}`, { cleanedMetadata: mp3Metadata });
            // Process files one by one to avoid overwhelming the server and ensure proper error handling
            for (const key of mp3Keys) {
                try {
                    logger_1.logger.info(`Updating metadata for file: ${key}`);
                    await r2Service_1.r2Service.updateMetadata(key, mp3Metadata);
                    updateResults.push({ key, success: true });
                    logger_1.logger.info(`Successfully updated metadata for: ${key}`);
                }
                catch (error) {
                    logger_1.logger.error(`Error updating metadata for ${key}`, { error });
                    updateResults.push({ key, success: false, error: error.message });
                }
            }
            logger_1.logger.info(`Completed metadata update for album: ${albumName}`);
            const successCount = updateResults.filter(result => result.success).length;
            res.json({
                message: `Metadata applied to ${successCount} of ${mp3Files.length} files in album: ${albumName}`,
                albumName,
                metadata,
                updatedFiles: updateResults
            });
        }
        catch (error) {
            logger_1.logger.error(`Error applying metadata to album ${req.params.albumName}`, { error });
            res.status(500).json({ error: error.message });
        }
    }
}
exports.AdminController = AdminController;
// Export a singleton instance
exports.adminController = new AdminController();
//# sourceMappingURL=adminController.js.map