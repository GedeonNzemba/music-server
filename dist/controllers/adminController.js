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
            const objects = await r2Service_1.r2Service.listObjects(prefix, delimiter);
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
            const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn, 10) : 3600;
            const url = r2Service_1.r2Service.getSignedUrl(key, expiresIn);
            res.json({ url });
        }
        catch (error) {
            logger_1.logger.error(`Error generating signed URL for ${req.params.key}`, { error });
            res.status(500).json({ error: error.message });
        }
    }
}
exports.AdminController = AdminController;
// Export a singleton instance
exports.adminController = new AdminController();
//# sourceMappingURL=adminController.js.map