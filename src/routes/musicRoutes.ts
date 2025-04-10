import { Router } from 'express';
import { musicController } from '../controllers/musicController';

const router = Router();

/**
 * @route   GET /api/music/albums
 * @desc    Get all albums
 * @access  Public
 */
router.get('/albums', musicController.listAlbums.bind(musicController));

/**
 * @route   GET /api/music/albums/:name
 * @desc    Get a specific album by name
 * @access  Public
 */
router.get('/albums/:name', musicController.getAlbum.bind(musicController));

/**
 * @route   GET /api/music/songs
 * @desc    Get all songs
 * @access  Public
 */
router.get('/songs', musicController.listAllSongs.bind(musicController));

/**
 * @route   GET /api/music/stream/:album/:song
 * @desc    Stream a specific song
 * @access  Public
 */
router.get('/stream/:album/:song', musicController.streamSong.bind(musicController));

/**
 * @route   GET /api/music/download/:album/:song
 * @desc    Download a specific song
 * @access  Public
 */
router.get('/download/:album/:song', musicController.downloadSong.bind(musicController));

/**
 * @route   GET /api/music/artists
 * @desc    Get all artists
 * @access  Public
 */
router.get('/artists', musicController.listArtists.bind(musicController));

/**
 * @route   GET /api/music/artists/:name
 * @desc    Get albums by artist name
 * @access  Public
 */
router.get('/artists/:name', musicController.getAlbumsByArtist.bind(musicController));

/**
 * @route   GET /api/music/artists/:name/songs
 * @desc    Get songs by artist name
 * @access  Public
 */
router.get('/artists/:name/songs', musicController.getSongsByArtist.bind(musicController));

/**
 * @route   GET /api/music/search
 * @desc    Search for songs by metadata (title, artist, album, genre, year, language)
 * @access  Public
 * @query   q=<search_term>
 * @query   limit=<number> (optional, default: 20) - Number of results per page
 * @query   offset=<number> (optional, default: 0) - Starting index for results
 */
router.get('/search', musicController.searchSongs.bind(musicController));

export default router;
