import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import multer from 'multer';
import path from 'path';
import { r2Service } from '../services/r2Service';
import { logger } from '../utils/logger';
import { Readable } from 'stream';
import archiver from 'archiver';

// Utility function to convert a stream to a string
async function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

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
router.post('/upload', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files as Express.Multer.File[];
    const targetPath = req.body.path || '';
    const applyAlbumMetadata = req.body.applyAlbumMetadata === 'true';
    const albumName = req.body.albumName;
    
    // Check if we need to apply album metadata
    let albumMetadata: Record<string, string> | null = null;
    if (targetPath.startsWith('albums/')) {
      try {
        // Extract album name from the path
        const pathParts = targetPath.split('/');
        const albumName = pathParts[1]; // albums/albumName/
        
        if (albumName) {
          // First try to get the album.json file directly
          try {
            const albumJsonKey = `albums/${albumName}/album.json`;
            const albumJsonObj = await r2Service.getObject(albumJsonKey);
            
            if (albumJsonObj && albumJsonObj.Body) {
              // Parse the JSON content
              const albumJsonContent = await streamToString(albumJsonObj.Body as any);
              const albumData = JSON.parse(albumJsonContent);
              
              if (albumData) {
                // Remove the albumName property if it exists
                const { albumName: _, ...metadataOnly } = albumData;
                albumMetadata = metadataOnly;
                logger.info(`Found album metadata in album.json for ${albumName}`, { albumMetadata });
              }
            }
          } catch (jsonErr) {
            logger.warn(`Could not read album.json for ${albumName}`, { error: jsonErr });
            
            // Fallback: try to get metadata from the album.json file's metadata
            try {
              const albumJsonKey = `albums/${albumName}/album.json`;
              albumMetadata = await r2Service.getMetadata(albumJsonKey);
              logger.info(`Found album metadata from album.json metadata for ${albumName}`, { albumMetadata });
            } catch (metadataErr) {
              logger.warn(`No album metadata found for ${albumName}`);
            }
          }
        }
      } catch (err) {
        logger.warn(`Error processing album metadata`, { error: err });
      }
    }
    
    // Process each file
    const uploadResults = await Promise.all(files.map(async (file) => {
      const fileName = file.originalname;
      const contentType = file.mimetype;
      
      // Construct the key (file path in R2)
      const key = path.join(targetPath, fileName).replace(/\\/g, '/');
      
      // Upload to R2
      const result = await r2Service.uploadFile(key, file.buffer, contentType);
      
      // If this is an MP3 file and we have album metadata, apply it
      if (albumMetadata && (contentType === 'audio/mpeg' || contentType === 'audio/mp3' || fileName.toLowerCase().endsWith('.mp3'))) {
        await r2Service.updateMetadata(key, albumMetadata);
        logger.info(`Applied album metadata to ${fileName}`);
      }
      
      return {
        originalName: fileName,
        key: result.Key,
        url: r2Service.getSignedUrl(result.Key),
        metadataApplied: albumMetadata && (contentType === 'audio/mpeg' || contentType === 'audio/mp3')
      };
    }));
    
    res.json({
      message: `${uploadResults.length} file(s) uploaded successfully`,
      files: uploadResults
    });
  } catch (error: any) {
    logger.error('Error uploading files', { error });
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
    const { name, metadata } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Album name is required' });
    }
    
    // Create an empty file to represent the folder (S3 doesn't have real folders)
    const folderKey = `albums/${name}/.folder`;
    await r2Service.uploadFile(folderKey, '', 'application/octet-stream');
    
    // If metadata was provided, create an album.json file with the metadata
    if (metadata && typeof metadata === 'object') {
      const albumJsonKey = `albums/${name}/album.json`;
      // Create a JSON file with album metadata
      const albumData = JSON.stringify({ albumName: name, ...metadata }, null, 2);
      await r2Service.uploadFile(albumJsonKey, albumData, 'application/json');
      
      // Also store the metadata as object metadata on the album.json file itself
      // This makes it easily accessible via the metadata API
      await r2Service.updateMetadata(albumJsonKey, metadata);
      
      logger.info(`Created album ${name} with metadata`, { metadata });
    } else {
      logger.info(`Created album ${name} without metadata`);
    }
    
    res.json({
      message: 'Album created successfully',
      albumName: name,
      path: `albums/${name}/`,
      metadata: metadata || null
    });
  } catch (error: any) {
    logger.error('Error creating album', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/admin/objects/:key/metadata
 * @desc    Get metadata for a file in R2
 * @access  Admin
 */
router.get('/objects/:key/metadata', (req, res) => {
  logger.info(`Metadata GET request received for key: ${req.params.key}`);
  adminController.getMetadata(req, res);
});

/**
 * @route   PUT /api/admin/objects/:key/metadata
 * @desc    Update metadata for a file in R2
 * @access  Admin
 */
router.put('/objects/:key/metadata', (req, res) => {
  logger.info(`Metadata PUT request received for key: ${req.params.key}`);
  adminController.updateMetadata(req, res);
});

/**
 * @route   PUT /api/admin/albums/:albumName/apply-metadata
 * @desc    Apply metadata to all songs in an album
 * @access  Admin
 */
router.put('/albums/:albumName/apply-metadata', (req, res) => {
  logger.info(`Apply metadata to all songs in album: ${req.params.albumName}`);
  adminController.applyMetadataToAlbum(req, res);
});

// Track download progress globally
let downloadProgress = 0;
let totalFilesCount = 0;
let processedFilesCount = 0;

/**
 * @route   GET /api/admin/download-all-albums
 * @desc    Download all albums as a zip file
 * @access  Admin
 */

// Add a dedicated HEAD route for progress checking
router.head('/download-all-albums', (req, res) => {
  logger.info(`Download progress check: ${downloadProgress}%, ${processedFilesCount}/${totalFilesCount} files processed`);
  
  // If download hasn't started yet but we're checking progress, initialize values
  if (totalFilesCount === 0) {
    // Set some initial values to indicate we're preparing
    downloadProgress = 5;
    totalFilesCount = 1;
    processedFilesCount = 0;
  }
  
  res.setHeader('X-Progress', downloadProgress.toString());
  res.setHeader('X-Total-Files', totalFilesCount.toString());
  res.setHeader('X-Processed-Files', processedFilesCount.toString());
  return res.status(200).end();
});

router.get('/download-all-albums', async (req, res) => {
  try {
    logger.info('Starting download of all albums as zip');
    
    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 5 } // Compression level (1-9)
    });
    
    // Set the appropriate headers for a zip file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=all-albums.zip');
    
    // Handle archive warnings
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        logger.warn('Archive warning:', err);
      } else {
        logger.error('Archive error:', err);
        throw err;
      }
    });
    
    // Handle archive errors
    archive.on('error', (err) => {
      logger.error('Archive error:', err);
      throw err;
    });
    
    // Pipe the archive data to the response
    archive.pipe(res);
    
    // List all albums
    const objects = await r2Service.listObjects('albums/');
    
    if (!objects.Contents || objects.Contents.length === 0) {
      throw new Error('No albums found');
    }
    
    // Get all album folders
    const albumFolders = new Set<string>();
    objects.Contents.forEach(obj => {
      if (obj.Key) {
        const parts = obj.Key.split('/');
        if (parts.length >= 2 && parts[0] === 'albums' && parts[1]) {
          albumFolders.add(parts[1]);
        }
      }
    });
    
    logger.info(`Found ${albumFolders.size} albums to download`);
    
    // Check if we have any albums to download
    if (albumFolders.size === 0) {
      logger.warn('No albums found to download');
      return res.status(404).json({ error: 'No albums found to download' });
    }
    
    // Count total files for progress tracking
    totalFilesCount = 0;
    processedFilesCount = 0;
    downloadProgress = 0;
    
    // First count all files
    for (const albumName of albumFolders) {
      const albumPrefix = `albums/${albumName}/`;
      const albumObjects = await r2Service.listObjects(albumPrefix);
      if (albumObjects.Contents) {
        totalFilesCount += albumObjects.Contents.filter(obj => 
          obj.Key && !obj.Key.endsWith('/.folder')
        ).length;
      }
    }
    
    logger.info(`Total files to process: ${totalFilesCount}`);
    
    // Process each album
    for (const albumName of albumFolders) {
      // List all files in the album
      const albumPrefix = `albums/${albumName}/`;
      const albumObjects = await r2Service.listObjects(albumPrefix);
      
      logger.info(`Processing album: ${albumName} (${albumObjects.Contents?.length || 0} files)`);
      
      if (albumObjects.Contents && albumObjects.Contents.length > 0) {
        // Process each file in the album
        for (const obj of albumObjects.Contents) {
          if (obj.Key) {
            // Skip folder markers
            if (obj.Key.endsWith('/.folder')) continue;
            
            try {
              // Get the file from R2
              const file = await r2Service.getObject(obj.Key);
              
              if (file && file.Body) {
                // Convert stream to buffer for archiver
                const chunks: Buffer[] = [];
                for await (const chunk of file.Body as any) {
                  chunks.push(Buffer.from(chunk));
                }
                const fileBuffer = Buffer.concat(chunks);
                
                // Add the file to the archive with the same path structure
                archive.append(fileBuffer, { name: obj.Key });
                
                processedFilesCount++;
                downloadProgress = Math.round((processedFilesCount / totalFilesCount) * 100);
                logger.info(`Added ${obj.Key} to zip archive (${processedFilesCount}/${totalFilesCount}, ${downloadProgress}%)`);
              }
            } catch (fileErr: any) {
              logger.error(`Error adding file to archive: ${obj.Key}`, { error: fileErr });
              // Continue with other files even if one fails
              processedFilesCount++;
              downloadProgress = Math.round((processedFilesCount / totalFilesCount) * 100);
            }
          }
        }
      }
    }
    
    // Finalize the archive
    await archive.finalize();
    logger.info('All albums zip archive created successfully');
  } catch (error: any) {
    logger.error('Error creating zip archive of all albums', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/admin/download-album/:albumName
 * @desc    Download a specific album as a zip file
 * @access  Admin
 */
router.get('/download-album/:albumName', async (req, res) => {
  try {
    const albumName = req.params.albumName;
    if (!albumName) {
      return res.status(400).json({ error: 'Album name is required' });
    }
    
    logger.info(`Starting download of album: ${albumName}`);
    
    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 5 } // Compression level (1-9)
    });
    
    // Set the appropriate headers for a zip file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(albumName)}.zip`);
    
    // Handle archive warnings
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        logger.warn('Archive warning:', err);
      } else {
        logger.error('Archive error:', err);
        throw err;
      }
    });
    
    // Handle archive errors
    archive.on('error', (err) => {
      logger.error('Archive error:', err);
      throw err;
    });
    
    // Pipe the archive data to the response
    archive.pipe(res);
    
    // List all files in the album
    const albumPrefix = `albums/${albumName}/`;
    const albumObjects = await r2Service.listObjects(albumPrefix);
    
    if (!albumObjects.Contents || albumObjects.Contents.length === 0) {
      throw new Error(`No files found in album: ${albumName}`);
    }
    
    logger.info(`Processing album: ${albumName} (${albumObjects.Contents.length} files)`);
    
    // Process each file in the album
    for (const obj of albumObjects.Contents) {
      if (obj.Key) {
        // Skip folder markers
        if (obj.Key.endsWith('/.folder')) continue;
        
        try {
          // Get the file from R2
          const file = await r2Service.getObject(obj.Key);
          
          if (file && file.Body) {
            try {
              // Get the file as a readable stream
              const stream = file.Body as any;
              
              // Add the file to the archive with a simplified path structure
              // Remove the 'albums/albumName/' prefix to make the zip cleaner
              const relativePath = obj.Key.replace(albumPrefix, '');
              
              // Append the stream directly to the archive
              archive.append(stream, { name: relativePath });
              
              logger.info(`Added ${obj.Key} to zip archive`);
            } catch (streamErr) {
              logger.error(`Error processing stream for ${obj.Key}:`, streamErr);
            }
          }
        } catch (fileErr: any) {
          logger.error(`Error adding file to archive: ${obj.Key}`, { error: fileErr });
          // Continue with other files even if one fails
        }
      }
    }
    
    // Finalize the archive
    await archive.finalize();
    logger.info(`Album ${albumName} zip archive created successfully`);
  } catch (error: any) {
    logger.error(`Error creating zip archive for album: ${req.params.albumName}`, { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/admin/create-folder
 * @desc    Create a new folder at any path
 * @access  Admin
 */
router.post('/create-folder', async (req, res) => {
  try {
    const { name, path } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    // Normalize the path to ensure it ends with a slash if not empty
    const normalizedPath = path && !path.endsWith('/') ? `${path}/` : path || '';
    
    // Create the folder marker
    const folderKey = `${normalizedPath}${name}/.folder`;
    await r2Service.uploadFile(folderKey, '', 'application/octet-stream');
    
    logger.info(`Created folder: ${folderKey}`);
    res.status(201).json({ 
      message: 'Folder created successfully', 
      name,
      path: normalizedPath,
      fullPath: `${normalizedPath}${name}/`
    });
  } catch (error: any) {
    logger.error('Error creating folder:', { error });
    res.status(500).json({ error: error.message });
  }
});

export default router;
