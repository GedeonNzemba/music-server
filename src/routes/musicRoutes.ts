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

export default router;
