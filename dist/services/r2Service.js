"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.r2Service = exports.R2Service = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
// Configure AWS SDK for Cloudflare R2
const s3 = new aws_sdk_1.default.S3({
    endpoint: env_1.env.R2.ENDPOINT,
    accessKeyId: env_1.env.R2.ACCESS_KEY_ID,
    secretAccessKey: env_1.env.R2.SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    region: env_1.env.R2.REGION,
});
class R2Service {
    constructor() {
        this.bucketName = env_1.env.R2.BUCKET_NAME;
        this.publicUrl = env_1.env.R2.PUBLIC_URL;
        this.endpoint = env_1.env.R2.ENDPOINT;
        this.accessKeyId = env_1.env.R2.ACCESS_KEY_ID;
        this.secretAccessKey = env_1.env.R2.SECRET_ACCESS_KEY;
        this.region = env_1.env.R2.REGION;
    }
    /**
     * List all albums in the R2 bucket
     */
    async listAlbums(limit, offset) {
        try {
            const data = await s3.listObjectsV2({
                Bucket: this.bucketName,
                Prefix: 'albums/',
                Delimiter: '/',
            }).promise();
            let albums = await Promise.all((data.CommonPrefixes || []).map(async (prefix) => {
                const albumName = prefix.Prefix.replace('albums/', '').replace('/', '');
                const albumPath = `albums/${albumName}/`;
                // Get the total number of music files in this album
                const albumFiles = await s3.listObjectsV2({
                    Bucket: this.bucketName,
                    Prefix: albumPath,
                }).promise();
                const musicCount = (albumFiles.Contents || []).filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav')).length;
                // Try to get artist information
                let artist = undefined;
                // First try to get album.json if it exists
                const albumJsonKey = `${albumPath}album.json`;
                try {
                    const albumData = await s3.getObject({
                        Bucket: this.bucketName,
                        Key: albumJsonKey
                    }).promise();
                    if (albumData.Body) {
                        const albumInfo = JSON.parse(albumData.Body.toString('utf-8'));
                        if (albumInfo.artist) {
                            artist = albumInfo.artist;
                        }
                    }
                }
                catch (error) {
                    // album.json doesn't exist or couldn't be parsed, try metadata approach
                    // Find the first MP3 file and get its metadata
                    const mp3File = (albumFiles.Contents || []).find(file => file.Key.endsWith('.mp3'));
                    if (mp3File) {
                        try {
                            const metadata = await this.getMetadata(mp3File.Key);
                            if (metadata.artist) {
                                artist = metadata.artist;
                            }
                        }
                        catch (metaError) {
                            logger_1.logger.error(`Error getting metadata for ${mp3File.Key}`, { error: metaError });
                        }
                    }
                }
                return {
                    name: albumName,
                    imageUrl: `${this.publicUrl}/albums/${encodeURIComponent(albumName)}/Album.jpg`,
                    totalMusic: musicCount,
                    artist: artist
                };
            }));
            // Apply pagination
            if (offset && offset > 0) {
                albums = albums.slice(offset);
            }
            if (limit) {
                albums = albums.slice(0, limit);
            }
            return albums;
        }
        catch (error) {
            logger_1.logger.error('Error listing albums from R2', { error });
            throw error;
        }
    }
    /**
     * Get a specific album by name
     */
    async getAlbum(name, limit, offset) {
        try {
            const albumPath = `albums/${name}/`;
            // List all files in the album folder
            const data = await s3.listObjectsV2({
                Bucket: this.bucketName,
                Prefix: albumPath,
            }).promise();
            // Check if album exists
            if (!data.Contents || data.Contents.length === 0) {
                throw new Error('Album not found');
            }
            // Try to get artist information
            let artist = undefined;
            // First try to get album.json if it exists
            const albumJsonKey = `${albumPath}album.json`;
            try {
                const albumData = await s3.getObject({
                    Bucket: this.bucketName,
                    Key: albumJsonKey
                }).promise();
                if (albumData.Body) {
                    const albumInfo = JSON.parse(albumData.Body.toString('utf-8'));
                    if (albumInfo.artist) {
                        artist = albumInfo.artist;
                    }
                }
            }
            catch (jsonError) {
                // album.json doesn't exist or couldn't be parsed, try metadata approach
                // Find the first MP3 file and get its metadata
                const mp3File = (data.Contents || []).find(file => file.Key.endsWith('.mp3'));
                if (mp3File) {
                    try {
                        const metadata = await this.getMetadata(mp3File.Key);
                        if (metadata.artist) {
                            artist = metadata.artist;
                        }
                    }
                    catch (metaError) {
                        logger_1.logger.error(`Error getting metadata for ${mp3File.Key}`, { error: metaError });
                    }
                }
            }
            // Filter only music files
            let musicFiles = (data.Contents || [])
                .filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav'))
                .map(file => ({
                title: file.Key.replace(albumPath, '').replace(/\.(mp3|wav)$/i, ''),
                url: `${this.publicUrl}/${file.Key}`,
                key: file.Key,
                size: file.Size,
                lastModified: file.LastModified
            }));
            // Apply pagination
            if (offset && offset > 0) {
                musicFiles = musicFiles.slice(offset);
            }
            if (limit) {
                musicFiles = musicFiles.slice(0, limit);
            }
            return {
                name,
                imageUrl: `${this.publicUrl}/albums/${encodeURIComponent(name)}/Album.jpg`,
                totalMusic: (data.Contents || []).filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav')).length,
                artist,
                musicFiles
            };
        }
        catch (error) {
            logger_1.logger.error(`Error getting album ${name} from R2`, { error });
            throw error;
        }
    }
    /**
     * List all songs across all albums
     */
    async listAllSongs(limit, offset, shuffle) {
        try {
            const albumPrefix = 'albums/';
            // Fetch all objects in the "albums" folder
            const data = await s3.listObjectsV2({
                Bucket: this.bucketName,
                Prefix: albumPrefix,
            }).promise();
            // Create a map to store album images and artists
            const albumImages = {};
            const albumArtists = {};
            const albumJsons = {};
            // First pass: identify album images and album.json files
            (data.Contents || []).forEach(file => {
                const filePath = file.Key.replace(albumPrefix, '');
                const parts = filePath.split('/');
                // If the file is a .jpg, use it as the album image
                if (parts.length === 2 && filePath.endsWith('.jpg')) {
                    const albumName = parts[0];
                    if (!albumImages[albumName]) {
                        albumImages[albumName] = `${this.publicUrl}/${file.Key}`;
                    }
                }
                // Track album.json files for later processing
                if (parts.length === 2 && parts[1] === 'album.json') {
                    albumJsons[parts[0]] = true;
                }
            });
            // Process album.json files to extract artist information
            await Promise.all(Object.keys(albumJsons).map(async (albumName) => {
                try {
                    const albumJsonKey = `albums/${albumName}/album.json`;
                    const albumData = await s3.getObject({
                        Bucket: this.bucketName,
                        Key: albumJsonKey
                    }).promise();
                    if (albumData.Body) {
                        const albumInfo = JSON.parse(albumData.Body.toString('utf-8'));
                        if (albumInfo.artist) {
                            albumArtists[albumName] = albumInfo.artist;
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Error getting album.json for ${albumName}`, { error });
                }
            }));
            // Filter only music files
            const songFiles = (data.Contents || [])
                .filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav'));
            // Process songs and get metadata for those without artist info from album.json
            let allSongs = await Promise.all(songFiles.map(async (file) => {
                const filePath = file.Key.replace(albumPrefix, '');
                const parts = filePath.split('/');
                const albumName = parts[0];
                const songTitle = parts[1].replace(/\.(mp3|wav)$/i, '');
                // If we don't have artist info for this album yet, try to get it from metadata
                let artist = albumArtists[albumName];
                if (!artist) {
                    try {
                        const metadata = await this.getMetadata(file.Key);
                        if (metadata.artist) {
                            artist = metadata.artist;
                            // Cache the artist for other songs in this album
                            albumArtists[albumName] = artist;
                        }
                    }
                    catch (error) {
                        logger_1.logger.error(`Error getting metadata for ${file.Key}`, { error });
                    }
                }
                return {
                    title: songTitle,
                    album: albumName,
                    albumImage: albumImages[albumName] || null,
                    artist: artist || null,
                    url: `${this.publicUrl}/${file.Key}`,
                    key: file.Key,
                    size: file.Size,
                    lastModified: file.LastModified
                };
            }));
            // Shuffle if requested
            if (shuffle) {
                // Fisher-Yates shuffle algorithm for better randomization
                for (let i = allSongs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allSongs[i], allSongs[j]] = [allSongs[j], allSongs[i]];
                }
            }
            // Store total count before pagination
            const totalSongs = allSongs.length;
            // Apply pagination
            if (offset && offset > 0) {
                allSongs = allSongs.slice(offset);
            }
            if (limit) {
                allSongs = allSongs.slice(0, limit);
            }
            return {
                totalSongs,
                songs: allSongs
            };
        }
        catch (error) {
            logger_1.logger.error('Error listing all songs from R2', { error });
            throw error;
        }
    }
    /**
     * Generate a streaming URL for a song
     */
    async getStreamingUrl(album, song, range) {
        try {
            const fileKey = `albums/${album}/${song}.mp3`;
            // Get metadata (needed for content length)
            const songData = await s3.headObject({
                Bucket: this.bucketName,
                Key: fileKey
            }).promise();
            const fileSize = songData.ContentLength || 0;
            if (!range) {
                throw new Error('Range header is required for streaming');
            }
            // Parse range header (e.g., "bytes=0-")
            const [start, end] = range.replace(/bytes=/, "").split("-").map(Number);
            const chunkEnd = end || Math.min(start + 10 * 1024 * 1024, fileSize - 1);
            const contentLength = chunkEnd - start + 1;
            // Stream file from R2
            const stream = s3.getObject({
                Bucket: this.bucketName,
                Key: fileKey,
                Range: `bytes=${start}-${chunkEnd}`
            }).createReadStream();
            return {
                stream,
                contentLength,
                contentRange: `bytes ${start}-${chunkEnd}/${fileSize}`,
                fileSize
            };
        }
        catch (error) {
            logger_1.logger.error(`Error streaming song ${song} from album ${album}`, { error });
            throw error;
        }
    }
    /**
     * Generate a download URL for a song
     */
    async getDownloadStream(album, song) {
        try {
            const fileKey = `albums/${album}/${song}.mp3`;
            // Fetch the file from R2
            const fileStream = s3.getObject({
                Bucket: this.bucketName,
                Key: fileKey
            }).createReadStream();
            return fileStream;
        }
        catch (error) {
            logger_1.logger.error(`Error downloading song ${song} from album ${album}`, { error });
            throw error;
        }
    }
    /**
     * Generate a signed URL for a song (for temporary access)
     */
    getSignedUrl(key, expiresIn = 3600) {
        return s3.getSignedUrl('getObject', {
            Bucket: this.bucketName,
            Key: key,
            Expires: expiresIn // URL expires in specified seconds (default: 1 hour)
        });
    }
    /**
     * List all objects in a directory
     */
    async listObjects(prefix, delimiter) {
        try {
            return await s3.listObjectsV2({
                Bucket: this.bucketName,
                Prefix: prefix,
                Delimiter: delimiter
            }).promise();
        }
        catch (error) {
            logger_1.logger.error(`Error listing objects with prefix ${prefix}`, { error });
            throw error;
        }
    }
    /**
     * Upload a file to R2
     */
    async uploadFile(key, body, contentType) {
        try {
            return await s3.upload({
                Bucket: this.bucketName,
                Key: key,
                Body: body,
                ContentType: contentType
            }).promise();
        }
        catch (error) {
            logger_1.logger.error(`Error uploading file ${key}`, { error });
            throw error;
        }
    }
    /**
     * Delete a file from R2
     */
    async deleteFile(key) {
        try {
            return await s3.deleteObject({
                Bucket: this.bucketName,
                Key: key
            }).promise();
        }
        catch (error) {
            logger_1.logger.error(`Error deleting file ${key}`, { error });
            throw error;
        }
    }
    /**
     * Get an object from R2
     */
    async getObject(key) {
        try {
            return await s3.getObject({
                Bucket: this.bucketName,
                Key: key
            }).promise();
        }
        catch (error) {
            logger_1.logger.error(`Error getting object ${key}`, { error });
            throw error;
        }
    }
    /**
     * Get metadata for a file in R2
     */
    async getMetadata(key) {
        try {
            const data = await s3.headObject({
                Bucket: this.bucketName,
                Key: key
            }).promise();
            // Extract metadata from the response
            const metadata = {};
            if (data.Metadata) {
                // Log the raw metadata for debugging
                logger_1.logger.info(`Raw metadata for ${key}:`, { rawMetadata: data.Metadata });
                // Process each metadata entry
                Object.entries(data.Metadata).forEach(([key, value]) => {
                    if (value) {
                        // Store the metadata with the original key (lowercase)
                        metadata[key.toLowerCase()] = value;
                    }
                });
            }
            // If this is an MP3 file, check for standard ID3-like metadata fields
            if (key.toLowerCase().endsWith('.mp3')) {
                // Map common metadata fields that might be in different formats
                const standardFields = ['artist', 'album', 'year', 'genre', 'copyright', 'title'];
                standardFields.forEach(field => {
                    // If we don't have the standard field but have it with a prefix, use that
                    if (!metadata[field]) {
                        // Check for prefixed versions (e.g., 'x-amz-meta-artist')
                        Object.entries(data.Metadata || {}).forEach(([metaKey, metaValue]) => {
                            if (metaValue && metaKey.toLowerCase().includes(field)) {
                                metadata[field] = metaValue;
                            }
                        });
                    }
                });
            }
            logger_1.logger.info(`Processed metadata for ${key}:`, { metadata });
            return metadata;
        }
        catch (error) {
            logger_1.logger.error(`Error getting metadata for file ${key}`, { error });
            throw error;
        }
    }
    /**
     * List all artists based on album metadata
     */
    async listArtists() {
        try {
            // First, get all albums
            const data = await s3.listObjectsV2({
                Bucket: this.bucketName,
                Prefix: 'albums/',
                Delimiter: '/',
            }).promise();
            // Map to track artists and their albums
            const artistMap = new Map();
            // Process each album to extract artist information
            await Promise.all((data.CommonPrefixes || []).map(async (prefix) => {
                const albumName = prefix.Prefix.replace('albums/', '').replace('/', '');
                const albumPath = `albums/${albumName}/`;
                try {
                    // Try to get album.json if it exists
                    const albumJsonKey = `${albumPath}album.json`;
                    try {
                        // First try to get album.json
                        const albumData = await s3.getObject({
                            Bucket: this.bucketName,
                            Key: albumJsonKey
                        }).promise();
                        if (albumData.Body) {
                            const albumInfo = JSON.parse(albumData.Body.toString('utf-8'));
                            if (albumInfo.artist) {
                                // Add this album to the artist's set
                                if (!artistMap.has(albumInfo.artist)) {
                                    artistMap.set(albumInfo.artist, new Set());
                                }
                                artistMap.get(albumInfo.artist).add(albumName);
                                return; // We found the artist, no need to check metadata
                            }
                        }
                    }
                    catch (error) {
                        // album.json doesn't exist or couldn't be parsed, try metadata approach
                        logger_1.logger.info(`No album.json found for ${albumName}, trying metadata approach`);
                    }
                    // If we get here, try to find any MP3 file in the album and get its metadata
                    const albumFiles = await s3.listObjectsV2({
                        Bucket: this.bucketName,
                        Prefix: albumPath,
                    }).promise();
                    // Find the first MP3 file
                    const mp3File = (albumFiles.Contents || []).find(file => file.Key.endsWith('.mp3'));
                    if (mp3File) {
                        // Get metadata from the MP3 file
                        const metadata = await this.getMetadata(mp3File.Key);
                        if (metadata.artist) {
                            // Add this album to the artist's set
                            if (!artistMap.has(metadata.artist)) {
                                artistMap.set(metadata.artist, new Set());
                            }
                            artistMap.get(metadata.artist).add(albumName);
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Error processing album ${albumName} for artists`, { error });
                }
            }));
            // Convert the map to the expected response format
            const artists = Array.from(artistMap.entries()).map(([name, albums]) => ({
                name,
                albums: albums.size
            }));
            // Sort artists alphabetically
            artists.sort((a, b) => a.name.localeCompare(b.name));
            return { artists };
        }
        catch (error) {
            logger_1.logger.error('Error listing artists from R2', { error });
            throw error;
        }
    }
    /**
     * Get albums by artist name
     */
    async getAlbumsByArtist(artistName, limit, offset) {
        try {
            // First, get all albums
            const data = await s3.listObjectsV2({
                Bucket: this.bucketName,
                Prefix: 'albums/',
                Delimiter: '/',
            }).promise();
            // Array to store albums by this artist
            const artistAlbums = [];
            // Process each album to check if it belongs to the artist
            await Promise.all((data.CommonPrefixes || []).map(async (prefix) => {
                const albumName = prefix.Prefix.replace('albums/', '').replace('/', '');
                const albumPath = `albums/${albumName}/`;
                try {
                    let isArtistAlbum = false;
                    let albumArtist = '';
                    // Try to get album.json if it exists
                    const albumJsonKey = `${albumPath}album.json`;
                    try {
                        // First try to get album.json
                        const albumData = await s3.getObject({
                            Bucket: this.bucketName,
                            Key: albumJsonKey
                        }).promise();
                        if (albumData.Body) {
                            const albumInfo = JSON.parse(albumData.Body.toString('utf-8'));
                            if (albumInfo.artist) {
                                albumArtist = albumInfo.artist;
                                isArtistAlbum = albumInfo.artist.toLowerCase() === artistName.toLowerCase();
                            }
                        }
                    }
                    catch (error) {
                        // album.json doesn't exist or couldn't be parsed, try metadata approach
                        logger_1.logger.info(`No album.json found for ${albumName}, trying metadata approach`);
                    }
                    // If we haven't determined the artist yet, try to find any MP3 file in the album and get its metadata
                    if (!isArtistAlbum) {
                        const albumFiles = await s3.listObjectsV2({
                            Bucket: this.bucketName,
                            Prefix: albumPath,
                        }).promise();
                        // Find the first MP3 file
                        const mp3File = (albumFiles.Contents || []).find(file => file.Key.endsWith('.mp3'));
                        if (mp3File) {
                            // Get metadata from the MP3 file
                            const metadata = await this.getMetadata(mp3File.Key);
                            if (metadata.artist) {
                                albumArtist = metadata.artist;
                                isArtistAlbum = metadata.artist.toLowerCase() === artistName.toLowerCase();
                            }
                        }
                    }
                    // If this album belongs to the requested artist, add it to the result
                    if (isArtistAlbum) {
                        // Get the total number of music files in this album
                        const albumFiles = await s3.listObjectsV2({
                            Bucket: this.bucketName,
                            Prefix: albumPath,
                        }).promise();
                        const musicCount = (albumFiles.Contents || []).filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav')).length;
                        artistAlbums.push({
                            name: albumName,
                            imageUrl: `${this.publicUrl}/albums/${encodeURIComponent(albumName)}/Album.jpg`,
                            totalMusic: musicCount
                        });
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Error processing album ${albumName} for artist ${artistName}`, { error });
                }
            }));
            // Sort albums alphabetically
            artistAlbums.sort((a, b) => a.name.localeCompare(b.name));
            // Apply pagination
            let paginatedAlbums = [...artistAlbums];
            if (offset !== undefined && offset > 0) {
                paginatedAlbums = paginatedAlbums.slice(offset);
            }
            if (limit !== undefined) {
                paginatedAlbums = paginatedAlbums.slice(0, limit);
            }
            return {
                artist: artistName,
                albums: paginatedAlbums
            };
        }
        catch (error) {
            logger_1.logger.error(`Error getting albums for artist ${artistName} from R2`, { error });
            throw error;
        }
    }
    /**
     * Get all songs by artist name
     */
    async getSongsByArtist(artistName, limit, offset, shuffle) {
        try {
            // First, get all albums by this artist (without pagination to get all albums)
            const { albums } = await this.getAlbumsByArtist(artistName);
            // Array to store all songs by this artist
            let allSongs = [];
            // Process each album to get its songs
            await Promise.all(albums.map(async (album) => {
                try {
                    // Get the album details including songs
                    const albumDetails = await this.getAlbum(album.name);
                    // Add each song to the result, including album information
                    if (albumDetails.musicFiles) {
                        const albumSongs = albumDetails.musicFiles.map(musicFile => ({
                            title: musicFile.title,
                            album: album.name,
                            albumImage: album.imageUrl,
                            artist: artistName, // Include the artist name
                            url: musicFile.url,
                            key: musicFile.key,
                            size: musicFile.size,
                            lastModified: musicFile.lastModified
                        }));
                        allSongs = [...allSongs, ...albumSongs];
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Error getting songs from album ${album.name} for artist ${artistName}`, { error });
                }
            }));
            // Shuffle the songs if requested
            if (shuffle) {
                // Fisher-Yates shuffle algorithm
                for (let i = allSongs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allSongs[i], allSongs[j]] = [allSongs[j], allSongs[i]];
                }
            }
            else {
                // Sort by album name and then by title if not shuffling
                allSongs.sort((a, b) => {
                    const albumCompare = a.album.localeCompare(b.album);
                    if (albumCompare !== 0)
                        return albumCompare;
                    return a.title.localeCompare(b.title);
                });
            }
            // Store the total number of songs before pagination
            const totalSongs = allSongs.length;
            // Apply pagination
            if (offset !== undefined && offset > 0) {
                allSongs = allSongs.slice(offset);
            }
            if (limit !== undefined) {
                allSongs = allSongs.slice(0, limit);
            }
            return {
                artist: artistName,
                totalSongs,
                songs: allSongs
            };
        }
        catch (error) {
            logger_1.logger.error(`Error getting songs for artist ${artistName} from R2`, { error });
            throw error;
        }
    }
    /**
     * Update metadata for a file in R2
     */
    async updateMetadata(key, metadata) {
        try {
            logger_1.logger.info(`Starting metadata update for ${key}`);
            logger_1.logger.info(`Received metadata:`, { metadata });
            // Get the existing object to preserve its content type and metadata
            const existingObject = await s3.headObject({
                Bucket: this.bucketName,
                Key: key
            }).promise();
            // Create a clean metadata object
            const cleanedMetadata = {};
            // First, copy any existing metadata we want to preserve
            const existingMetadata = existingObject.Metadata || {};
            logger_1.logger.info(`Retrieved existing metadata for ${key}:`, { existingMetadata });
            // Track which fields should be removed
            const fieldsToRemove = new Set();
            // Identify fields to remove (empty string values)
            Object.entries(metadata).forEach(([k, v]) => {
                if (v !== undefined && v !== null) {
                    const lowerKey = k.toLowerCase();
                    const stringValue = String(v).trim();
                    if (stringValue === '') {
                        logger_1.logger.info(`Marking field for removal: ${lowerKey}`);
                        fieldsToRemove.add(lowerKey);
                    }
                }
            });
            // Copy existing metadata, excluding fields marked for removal
            Object.entries(existingMetadata).forEach(([k, v]) => {
                const lowerKey = k.toLowerCase();
                if (!fieldsToRemove.has(lowerKey) && v !== undefined && v !== null) {
                    cleanedMetadata[lowerKey] = String(v);
                }
                else if (fieldsToRemove.has(lowerKey)) {
                    logger_1.logger.info(`Skipping field marked for removal: ${lowerKey}`);
                }
            });
            // Then apply new metadata, overwriting existing values (but not adding back removed fields)
            Object.entries(metadata).forEach(([k, v]) => {
                const lowerKey = k.toLowerCase();
                // Skip undefined/null values and empty strings (removals)
                if (v === undefined || v === null || String(v).trim() === '')
                    return;
                const stringValue = String(v).trim();
                // Add/update the field
                cleanedMetadata[lowerKey] = stringValue;
            });
            // Ensure album name is set if we're in an album folder
            if (!cleanedMetadata['album'] && key.startsWith('albums/')) {
                const albumName = key.split('/')[1];
                if (albumName) {
                    cleanedMetadata['album'] = albumName;
                }
            }
            logger_1.logger.info(`Applying final metadata to ${key}:`, { metadata: cleanedMetadata });
            // Copy the object to itself with new metadata
            const result = await s3.copyObject({
                Bucket: this.bucketName,
                CopySource: `${this.bucketName}/${encodeURIComponent(key)}`,
                Key: key,
                Metadata: cleanedMetadata,
                MetadataDirective: 'REPLACE',
                ContentType: existingObject.ContentType
            }).promise();
            logger_1.logger.info(`Successfully updated metadata for ${key}`);
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Error updating metadata for file ${key}`, { error });
            throw error;
        }
    }
}
exports.R2Service = R2Service;
// Export a singleton instance
exports.r2Service = new R2Service();
//# sourceMappingURL=r2Service.js.map