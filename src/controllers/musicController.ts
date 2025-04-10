import { Request, Response } from 'express';
import { r2Service } from '../services/r2Service';
import { logger } from '../utils/logger';

export class MusicController {
  /**
   * List all albums
   */
  async listAlbums(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      
      const albums = await r2Service.listAlbums(limit, offset);
      
      res.json(albums);
    } catch (error: any) {
      logger.error('Error listing albums', { error });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get a specific album by name
   */
  async getAlbum(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      
      const album = await r2Service.getAlbum(name, limit, offset);
      
      res.json(album);
    } catch (error: any) {
      logger.error(`Error getting album ${req.params.name}`, { error });
      
      if (error.message === 'Album not found') {
        res.status(404).json({ error: 'Album not found' });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }

  /**
   * List all songs
   */
  async listAllSongs(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const shuffle = req.query.shuffle === 'true';
      
      const songs = await r2Service.listAllSongs(limit, offset, shuffle);
      
      res.json(songs);
    } catch (error: any) {
      logger.error('Error listing songs', { error });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Stream a song
   */
  async streamSong(req: Request, res: Response): Promise<void> {
    try {
      const { album, song } = req.params;
      const range = req.headers.range;
      
      if (!range) {
        res.status(400).send('Range header is required for streaming');
        return;
      }
      
      const { stream, contentLength, contentRange, fileSize } = await r2Service.getStreamingUrl(album, song, range);
      
      // Set response headers for partial content (streaming)
      res.setHeader('Content-Range', contentRange);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', contentLength);
      res.setHeader('Content-Type', 'audio/mp3');
      res.status(206);
      
      // Stream file to response
      stream.pipe(res);
    } catch (error: any) {
      logger.error(`Error streaming song ${req.params.song} from album ${req.params.album}`, { error });
      res.status(500).json({ error: 'Failed to stream song', details: error.message });
    }
  }

  /**
   * Download a song
   */
  async downloadSong(req: Request, res: Response): Promise<void> {
    try {
      const { album, song } = req.params;
      
      const fileStream = await r2Service.getDownloadStream(album, song);
      
      // Set headers to force download
      res.setHeader('Content-Disposition', `attachment; filename="${song}.mp3"`);
      res.setHeader('Content-Type', 'audio/mpeg');
      
      // Pipe the file stream to the response
      fileStream.pipe(res);
    } catch (error: any) {
      logger.error(`Error downloading song ${req.params.song} from album ${req.params.album}`, { error });
      res.status(500).json({ error: 'Failed to download song', details: error.message });
    }
  }

  /**
   * List all artists
   */
  async listArtists(req: Request, res: Response): Promise<void> {
    try {
      const artists = await r2Service.listArtists();
      res.json(artists);
    } catch (error: any) {
      logger.error('Error listing artists', { error });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get albums by artist
   */
  async getAlbumsByArtist(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      
      const artistAlbums = await r2Service.getAlbumsByArtist(name, limit, offset);
      
      res.json(artistAlbums);
    } catch (error: any) {
      logger.error(`Error getting albums for artist ${req.params.name}`, { error });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get songs by artist
   */
  async getSongsByArtist(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const shuffle = req.query.shuffle === 'true';
      
      const artistSongs = await r2Service.getSongsByArtist(name, limit, offset, shuffle);
      
      res.json(artistSongs);
    } catch (error: any) {
      logger.error(`Error getting songs for artist ${req.params.name}`, { error });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Search songs
   */
  async searchSongs(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20; // Default limit: 20
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0; // Default offset: 0

      if (!query) {
        res.status(400).json({ error: 'Search query parameter "q" is required.' });
        return;
      }

      // Fetch ALL songs first. Consider optimizing this later if performance is an issue.
      // We pass undefined for limit/offset to listAllSongs to get everything.
      const allSongsData = await r2Service.listAllSongs(undefined, 0, false);
      const allSongs = allSongsData.songs;

      const searchTerm = query.toLowerCase();

      const filteredSongs = allSongs.filter(song => {
        const titleMatch = song.title?.toLowerCase().includes(searchTerm);
        const albumMatch = song.album?.toLowerCase().includes(searchTerm);
        // Check both top-level artist and metadata artist
        const artistMatch = 
          song.artist?.toLowerCase().includes(searchTerm) || 
          song.metadata?.artist?.toLowerCase().includes(searchTerm);
        const genreMatch = song.metadata?.genre?.toLowerCase().includes(searchTerm);
        const yearMatch = song.metadata?.year?.toString().includes(searchTerm); // Year might be stored as number or string
        // Assuming 'language' might be a custom metadata field
        const languageMatch = song.metadata?.language?.toLowerCase().includes(searchTerm); 

        return titleMatch || albumMatch || artistMatch || genreMatch || yearMatch || languageMatch;
      });
      
      // Get total count *before* pagination
      const totalMatchedSongs = filteredSongs.length;

      // Apply pagination to the filtered results
      const paginatedSongs = filteredSongs.slice(offset, offset + limit);

      res.json({ 
        totalSongs: totalMatchedSongs, // Total number of songs matching the query
        limit: limit,               // The limit used for this response
        offset: offset,             // The offset used for this response
        songs: paginatedSongs       // The songs for the current page
      });

    } catch (error: any) {
      logger.error('Error searching songs', { query: req.query.q, error });
      res.status(500).json({ error: 'Failed to search songs', details: error.message });
    }
  }
}

// Export a singleton instance
export const musicController = new MusicController();
