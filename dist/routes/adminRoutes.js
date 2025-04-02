"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const r2Service_1 = require("../services/r2Service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Configure multer for file uploads
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    fileFilter: (_req, file, cb) => {
        // Accept audio files and images
        const allowedTypes = [
            'audio/mpeg', 'audio/mp3', 'audio/wav',
            'image/jpeg', 'image/jpg', 'image/png'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only MP3, WAV, JPG, and PNG files are allowed.'));
        }
    }
});
/**
 * @route   GET /api/admin/objects
 * @desc    List all objects in the R2 bucket (for admin interface)
 * @access  Admin
 */
router.get('/objects', adminController_1.adminController.listAllObjects.bind(adminController_1.adminController));
/**
 * @route   GET /api/admin/objects/:key/signed-url
 * @desc    Get a signed URL for a file (for admin preview)
 * @access  Admin
 */
router.get('/objects/:key/signed-url', adminController_1.adminController.getSignedUrl.bind(adminController_1.adminController));
/**
 * @route   DELETE /api/admin/objects/:key
 * @desc    Delete a file from R2
 * @access  Admin
 */
router.delete('/objects/:key', adminController_1.adminController.deleteFile.bind(adminController_1.adminController));
/**
 * @route   POST /api/admin/upload
 * @desc    Upload a file to R2
 * @access  Admin
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const file = req.file;
        const targetPath = req.body.path || '';
        const fileName = req.body.fileName || file.originalname;
        // Determine content type
        const contentType = file.mimetype;
        // Construct the key (file path in R2)
        const key = path_1.default.join(targetPath, fileName).replace(/\\/g, '/');
        // Upload to R2
        const result = await r2Service_1.r2Service.uploadFile(key, file.buffer, contentType);
        res.json({
            message: 'File uploaded successfully',
            key: result.Key,
            url: `${r2Service_1.r2Service.getSignedUrl(result.Key)}`
        });
    }
    catch (error) {
        logger_1.logger.error('Error uploading file', { error });
        res.status(500).json({ error: error.message });
    }
});
/**
 * @route   POST /api/admin/create-album
 * @desc    Create a new album folder
 * @access  Admin
 */
router.post('/create-album', async (req, res) => {
    try {
        const { albumName } = req.body;
        if (!albumName) {
            return res.status(400).json({ error: 'Album name is required' });
        }
        // Create an empty file to represent the folder (S3 doesn't have real folders)
        const key = `albums/${albumName}/.folder`;
        await r2Service_1.r2Service.uploadFile(key, '', 'application/octet-stream');
        res.json({
            message: 'Album created successfully',
            albumName,
            path: `albums/${albumName}/`
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating album', { error });
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map