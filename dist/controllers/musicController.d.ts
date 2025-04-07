import { Request, Response } from 'express';
export declare class MusicController {
    /**
     * List all albums
     */
    listAlbums(req: Request, res: Response): Promise<void>;
    /**
     * Get a specific album by name
     */
    getAlbum(req: Request, res: Response): Promise<void>;
    /**
     * List all songs
     */
    listAllSongs(req: Request, res: Response): Promise<void>;
    /**
     * Stream a song
     */
    streamSong(req: Request, res: Response): Promise<void>;
    /**
     * Download a song
     */
    downloadSong(req: Request, res: Response): Promise<void>;
    /**
     * List all artists
     */
    listArtists(req: Request, res: Response): Promise<void>;
    /**
     * Get albums by artist
     */
    getAlbumsByArtist(req: Request, res: Response): Promise<void>;
    /**
     * Get songs by artist
     */
    getSongsByArtist(req: Request, res: Response): Promise<void>;
}
export declare const musicController: MusicController;
