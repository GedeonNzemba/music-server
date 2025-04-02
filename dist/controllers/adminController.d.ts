import { Request, Response } from 'express';
export declare class AdminController {
    /**
     * List all objects in the R2 bucket (for admin interface)
     */
    listAllObjects(req: Request, res: Response): Promise<void>;
    /**
     * Delete a file from R2
     */
    deleteFile(req: Request, res: Response): Promise<void>;
    /**
     * Get signed URL for a file (for admin preview)
     */
    getSignedUrl(req: Request, res: Response): Promise<void>;
}
export declare const adminController: AdminController;
