const express = require('express');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3009;

// Configure AWS SDK for Cloudflare R2
const s3 = new AWS.S3({
  endpoint: process.env.END_POINT,  // Replace with your R2 endpoint URL
  accessKeyId: process.env.ACCESS_KEY_ID,  // Replace with your R2 access key
  secretAccessKey: process.env.SECRET_ACCESS_KEY,  // Replace with your R2 secret key
  signatureVersion: 'v4',  // Cloudflare R2 uses v4 signature
  region: 'auto',  // Region is 'auto' for R2
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/list-albums', async (req, res) => {
    // DATA TYPE
    // interface Album {
    //     name: string;
    //     imageUrl: string;
    //     totalMusic: number;
    //   }
      
    //   // Type for the array of albums
    //   type AlbumCollection = Album[];
    try {
        const { limit, offset } = req.query;
        const parsedLimit = limit ? parseInt(limit, 10) : null;
        const parsedOffset = offset ? parseInt(offset, 10) : 0;

        // List all albums (folders inside "albums/")
        const data = await s3.listObjectsV2({
            Bucket: 'saintshubappmusic',
            Prefix: 'albums/',
            Delimiter: '/',
        }).promise();

        let albums = await Promise.all(
            data.CommonPrefixes.map(async (prefix) => {
                const albumName = prefix.Prefix.replace('albums/', '').replace('/', '');
                const albumPath = `albums/${albumName}/`;

                // Get the total number of music files in this album
                const albumFiles = await s3.listObjectsV2({
                    Bucket: 'saintshubappmusic',
                    Prefix: albumPath,
                }).promise();

                const musicCount = albumFiles.Contents.filter(file =>
                    file.Key.endsWith('.mp3') || file.Key.endsWith('.wav') // Count music files
                ).length;

                return {
                    name: albumName,
                    imageUrl: `https://takemore.xyz/albums/${encodeURIComponent(albumName)}/Album.jpg`,
                    totalMusic: musicCount
                };
            })
        );

        // Apply pagination (offset & limit)
        if (parsedOffset > 0) {
            albums = albums.slice(parsedOffset);
        }
        if (parsedLimit) {
            albums = albums.slice(0, parsedLimit);
        }

        res.json(albums);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/list-songs', async (req, res) => {

    // DATA TYPE
    // interface Song {
    //     title: string;
    //     album: string;
    //     albumImage: string;
    //     url: string;
    //   }
      
    //   interface MusicCollection {
    //     totalSongs: number;
    //     songs: Song[];
    //   }
    try {
        const { limit, offset, shuffle } = req.query;
        const parsedLimit = limit ? parseInt(limit, 10) : null;
        const parsedOffset = offset ? parseInt(offset, 10) : 0;
        const shouldShuffle = shuffle === 'true'; // Convert to boolean

        const albumPrefix = 'albums/';

        // Fetch all objects in the "albums" folder
        const data = await s3.listObjectsV2({
            Bucket: 'saintshubappmusic',
            Prefix: albumPrefix,
        }).promise();

        // Create a map to store album images
        const albumImages = {};

        data.Contents.forEach(file => {
            const filePath = file.Key.replace(albumPrefix, '');
            const parts = filePath.split('/');

            // If the file is a .jpg, use it as the album image
            if (parts.length === 2 && filePath.endsWith('.jpg')) {
                const albumName = parts[0];
                if (!albumImages[albumName]) {
                    albumImages[albumName] = `https://takemore.xyz/${file.Key}`; // Store album image URL
                }
            }
        });

        // Filter only music files (.mp3, .wav, etc.)
        let allSongs = data.Contents
            .filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav'))
            .map(file => {
                const filePath = file.Key.replace(albumPrefix, '');
                const parts = filePath.split('/');
                const albumName = parts[0];
                const songTitle = parts[1].replace(/\.(mp3|wav)$/i, ''); // Remove extensions

                return {
                    title: songTitle,
                    album: albumName,
                    albumImage: albumImages[albumName] || null, // Attach album image
                    url: `https://takemore.xyz/${file.Key}`
                };
            });

        // 🔀 Shuffle the songs if requested
        if (shouldShuffle) {
            allSongs = allSongs.sort(() => Math.random() - 0.5);
        }

        // Apply pagination (offset & limit)
        if (parsedOffset > 0) {
            allSongs = allSongs.slice(parsedOffset);
        }
        if (parsedLimit) {
            allSongs = allSongs.slice(0, parsedLimit);
        }

        res.json({
            totalSongs: allSongs.length,
            songs: allSongs
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/album/:name', async (req, res) => {

// DATA TYPE
// interface MusicFile {
//     title: string;
//     url: string;
//   }
  
//   interface Album {
//     name: string;
//     imageUrl: string;
//     totalMusic: number;
//     musicFiles: MusicFile[];
//   }

    try {
        const { name } = req.params;
        const { limit, offset } = req.query;
        const parsedLimit = limit ? parseInt(limit, 10) : null;
        const parsedOffset = offset ? parseInt(offset, 10) : 0;
        
        const albumPath = `albums/${name}/`;

        // List all files in the album folder
        const data = await s3.listObjectsV2({
            Bucket: 'saintshubappmusic',
            Prefix: albumPath,
        }).promise();

        // Filter only music files (.mp3, .wav, etc.)
        let musicFiles = data.Contents
            .filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav'))
            .map(file => ({
                title: file.Key.replace(albumPath, '').replace('.mp3', ''), // Remove folder path & .mp3 extension
                url: `https://takemore.xyz/${file.Key}` // Generate full URL
            }));

        // Apply pagination (offset & limit)
        if (parsedOffset > 0) {
            musicFiles = musicFiles.slice(parsedOffset);
        }
        if (parsedLimit) {
            musicFiles = musicFiles.slice(0, parsedLimit);
        }

        // Check if album exists (should contain at least one file)
        if (data.Contents.length === 0) {
            return res.status(404).json({ error: 'Album not found' });
        }

        res.json({
            name,
            imageUrl: `https://takemore.xyz/albums/${encodeURIComponent(name)}/album.jpg`,
            totalMusic: data.Contents.filter(file => file.Key.endsWith('.mp3') || file.Key.endsWith('.wav')).length,
            musicFiles
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/stream-song/:album/:song', async (req, res) => {
    // DATA TYPE
    // IT WILL PLAY THE SONG
    const { album, song } = req.params;
    const fileKey = `albums/${album}/${song}.mp3`; // Path to the file in R2

    try {
        // Get metadata (needed for content length)
        const songData = await s3.headObject({
            Bucket: 'saintshubappmusic',
            Key: fileKey
        }).promise();

        const fileSize = songData.ContentLength;
        const range = req.headers.range;

        if (!range) {
            return res.status(400).send('Range header is required for streaming');
        }

        // Parse range header (e.g., "bytes=0-")
        const [start, end] = range.replace(/bytes=/, "").split("-").map(Number);
        const chunkEnd = end || Math.min(start + 10 * 1024 * 1024, fileSize - 1);
        const contentLength = chunkEnd - start + 1;

        // Set response headers for partial content (streaming)
        res.setHeader('Content-Range', `bytes ${start}-${chunkEnd}/${fileSize}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', contentLength);
        res.setHeader('Content-Type', 'audio/mp3');
        res.status(206);

        // Stream file from R2
        const stream = s3.getObject({
            Bucket: 'saintshubappmusic',
            Key: fileKey,
            Range: `bytes=${start}-${chunkEnd}`
        }).createReadStream();

        stream.pipe(res);
    } catch (err) {
        console.error('Error streaming file:', err);
        res.status(500).json({ error: 'Failed to stream song', details: err.message });
    }
});

app.get('/download-song/:album/:song', async (req, res) => {
    // DATA TYPE
    // IT WILL DOWNLOAD THE SONG

    const { album, song } = req.params;
    const fileKey = `albums/${album}/${song}.mp3`;

    try {
        // Generate a pre-signed URL
        const signedUrl = s3.getSignedUrl('getObject', {
            Bucket: 'saintshubappmusic',
            Key: fileKey,
            Expires: 3600 // URL expires in 1 hour
        });

        // Fetch the file from R2
        const fileStream = s3.getObject({
            Bucket: 'saintshubappmusic',
            Key: fileKey
        }).createReadStream();

        // Set headers to force download
        res.setHeader('Content-Disposition', `attachment; filename="${song}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // Pipe the file stream to the response
        fileStream.pipe(res);
    } catch (err) {
        console.error('Error generating download:', err);
        res.status(500).json({ error: 'Failed to download song' });
    }
});




// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
