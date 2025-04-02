"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const musicController_1 = require("../controllers/musicController");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/music/albums
 * @desc    Get all albums
 * @access  Public
 */
router.get('/albums', musicController_1.musicController.listAlbums.bind(musicController_1.musicController));
/**
 * @route   GET /api/music/albums/:name
 * @desc    Get a specific album by name
 * @access  Public
 */
router.get('/albums/:name', musicController_1.musicController.getAlbum.bind(musicController_1.musicController));
/**
 * @route   GET /api/music/songs
 * @desc    Get all songs
 * @access  Public
 */
router.get('/songs', musicController_1.musicController.listAllSongs.bind(musicController_1.musicController));
/**
 * @route   GET /api/music/stream/:album/:song
 * @desc    Stream a specific song
 * @access  Public
 */
router.get('/stream/:album/:song', musicController_1.musicController.streamSong.bind(musicController_1.musicController));
/**
 * @route   GET /api/music/download/:album/:song
 * @desc    Download a specific song
 * @access  Public
 */
router.get('/download/:album/:song', musicController_1.musicController.downloadSong.bind(musicController_1.musicController));
exports.default = router;
//# sourceMappingURL=musicRoutes.js.map