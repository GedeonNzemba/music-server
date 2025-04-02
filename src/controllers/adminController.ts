import { Request, Response } from 'express';
import { r2Service } from '../services/r2Service';
import { logger } from '../utils/logger';

export class AdminController {
  /**
   * List all objects in the R2 bucket (for admin interface)
   */
  async listAllObjects(req: Request, res: Response): Promise<void> {
    try {
      const prefix = req.query.prefix as string || '';
      const delimiter = req.query.delimiter as string;
      
      logger.info(`Listing objects with prefix: "${prefix}" and delimiter: "${delimiter}"`);
      
      const objects = await r2Service.listObjects(prefix, delimiter);
      
      logger.info(`Found ${objects.Contents?.length || 0} objects and ${objects.CommonPrefixes?.length || 0} common prefixes`);
      
      res.json({
        prefix,
        commonPrefixes: objects.CommonPrefixes || [],
        contents: objects.Contents || []
      });
    } catch (error: any) {
      logger.error('Error listing objects', { error });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete a file from R2
   */
  async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      
      if (!key) {
        res.status(400).json({ error: 'Key parameter is required' });
        return;
      }
      
      logger.info(`Deleting file with key: ${key}`);
      
      await r2Service.deleteFile(key);
      
      res.json({ message: 'File deleted successfully', key });
    } catch (error: any) {
      logger.error(`Error deleting file ${req.params.key}`, { error });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get signed URL for a file (for admin preview)
   */
  async getSignedUrl(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      
      if (!key) {
        res.status(400).json({ error: 'Key parameter is required' });
        return;
      }
      
      const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn as string, 10) : 3600;
      
      logger.info(`Generating signed URL for key: ${key} with expiration: ${expiresIn} seconds`);
      
      const url = r2Service.getSignedUrl(key, expiresIn);
      
      res.json({ url });
    } catch (error: any) {
      logger.error(`Error generating signed URL for ${req.params.key}`, { error });
      res.status(500).json({ error: error.message });
    }
  }
}

// Export a singleton instance
export const adminController = new AdminController();
