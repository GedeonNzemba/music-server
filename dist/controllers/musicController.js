"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.musicController = exports.MusicController = void 0;
const r2Service_1 = require("../services/r2Service");
const logger_1 = require("../utils/logger");
class MusicController {
    /**
     * List all albums
     */
    async listAlbums(req, res) {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
            const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
            const albums = await r2Service_1.r2Service.listAlbums(limit, offset);
            res.json(albums);
        }
        catch (error) {
            logger_1.logger.error('Error listing albums', { error });
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * Get a specific album by name
     */
    async getAlbum(req, res) {
        try {
            const { name } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
            const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
            const album = await r2Service_1.r2Service.getAlbum(name, limit, offset);
            res.json(album);
        }
        catch (error) {
            logger_1.logger.error(`Error getting album ${req.params.name}`, { error });
            if (error.message === 'Album not found') {
                res.status(404).json({ error: 'Album not found' });
            }
            else {
                res.status(500).json({ error: error.message });
            }
        }
    }
    /**
     * List all songs
     */
    async listAllSongs(req, res) {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
            const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
            const shuffle = req.query.shuffle === 'true';
            const songs = await r2Service_1.r2Service.listAllSongs(limit, offset, shuffle);
            res.json(songs);
        }
        catch (error) {
            logger_1.logger.error('Error listing songs', { error });
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * Stream a song
     */
    async streamSong(req, res) {
        try {
            const { album, song } = req.params;
            const range = req.headers.range;
            if (!range) {
                res.status(400).send('Range header is required for streaming');
                return;
            }
            const { stream, contentLength, contentRange, fileSize } = await r2Service_1.r2Service.getStreamingUrl(album, song, range);
            // Set response headers for partial content (streaming)
            res.setHeader('Content-Range', contentRange);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Length', contentLength);
            res.setHeader('Content-Type', 'audio/mp3');
            res.status(206);
            // Stream file to response
            stream.pipe(res);
        }
        catch (error) {
            logger_1.logger.error(`Error streaming song ${req.params.song} from album ${req.params.album}`, { error });
            res.status(500).json({ error: 'Failed to stream song', details: error.message });
        }
    }
    /**
     * Download a song
     */
    async downloadSong(req, res) {
        try {
            const { album, song } = req.params;
            const fileStream = await r2Service_1.r2Service.getDownloadStream(album, song);
            // Set headers to force download
            res.setHeader('Content-Disposition', `attachment; filename="${song}.mp3"`);
            res.setHeader('Content-Type', 'audio/mpeg');
            // Pipe the file stream to the response
            fileStream.pipe(res);
        }
        catch (error) {
            logger_1.logger.error(`Error downloading song ${req.params.song} from album ${req.params.album}`, { error });
            res.status(500).json({ error: 'Failed to download song', details: error.message });
        }
    }
    /**
     * List all artists
     */
    async listArtists(req, res) {
        try {
            const artists = await r2Service_1.r2Service.listArtists();
            res.json(artists);
        }
        catch (error) {
            logger_1.logger.error('Error listing artists', { error });
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * Get albums by artist
     */
    async getAlbumsByArtist(req, res) {
        try {
            const { name } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
            const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
            const artistAlbums = await r2Service_1.r2Service.getAlbumsByArtist(name, limit, offset);
            res.json(artistAlbums);
        }
        catch (error) {
            logger_1.logger.error(`Error getting albums for artist ${req.params.name}`, { error });
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * Get songs by artist
     */
    async getSongsByArtist(req, res) {
        try {
            const { name } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
            const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
            const shuffle = req.query.shuffle === 'true';
            const artistSongs = await r2Service_1.r2Service.getSongsByArtist(name, limit, offset, shuffle);
            res.json(artistSongs);
        }
        catch (error) {
            logger_1.logger.error(`Error getting songs for artist ${req.params.name}`, { error });
            res.status(500).json({ error: error.message });
        }
    }
}
exports.MusicController = MusicController;
// Export a singleton instance
exports.musicController = new MusicController();
//# sourceMappingURL=musicController.js.map