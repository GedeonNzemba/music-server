import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import multer from 'multer';
import path from 'path';
import { r2Service } from '../services/r2Service';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
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
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, JPG, and PNG files are allowed.'));
    }
  }
});

/**
 * @route   GET /api/admin/objects
 * @desc    List all objects in the R2 bucket (for admin interface)
 * @access  Admin
 */
router.get('/objects', adminController.listAllObjects.bind(adminController));

/**
 * @route   GET /api/admin/objects/:key/signed-url
 * @desc    Get a signed URL for a file (for admin preview)
 * @access  Admin
 */
router.get('/objects/:key/signed-url', adminController.getSignedUrl.bind(adminController));

/**
 * @route   DELETE /api/admin/objects/:key
 * @desc    Delete a file from R2
 * @access  Admin
 */
router.delete('/objects/:key', adminController.deleteFile.bind(adminController));

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
    const key = path.join(targetPath, fileName).replace(/\\/g, '/');
    
    // Upload to R2
    const result = await r2Service.uploadFile(key, file.buffer, contentType);
    
    res.json({
      message: 'File uploaded successfully',
      key: result.Key,
      url: `${r2Service.getSignedUrl(result.Key)}`
    });
  } catch (error: any) {
    logger.error('Error uploading file', { error });
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
    
    await r2Service.uploadFile(key, '', 'application/octet-stream');
    
    res.json({
      message: 'Album created successfully',
      albumName,
      path: `albums/${albumName}/`
    });
  } catch (error: any) {
    logger.error('Error creating album', { error });
    res.status(500).json({ error: error.message });
  }
});

export default router;
