import AWS from 'aws-sdk';
export interface MusicFile {
    title: string;
    url: string;
    key: string;
    size?: number;
    lastModified?: Date;
}
export interface Album {
    name: string;
    imageUrl: string;
    totalMusic: number;
    musicFiles?: MusicFile[];
}
export interface Song {
    title: string;
    album: string;
    albumImage: string | null;
    url: string;
    key: string;
    size?: number;
    lastModified?: Date;
}
export interface MusicCollection {
    totalSongs: number;
    songs: Song[];
}
export declare class R2Service {
    private bucketName;
    private publicUrl;
    constructor();
    /**
     * List all albums in the R2 bucket
     */
    listAlbums(limit?: number, offset?: number): Promise<Album[]>;
    /**
     * Get a specific album by name
     */
    getAlbum(name: string, limit?: number, offset?: number): Promise<Album>;
    /**
     * List all songs across all albums
     */
    listAllSongs(limit?: number, offset?: number, shuffle?: boolean): Promise<MusicCollection>;
    /**
     * Generate a streaming URL for a song
     */
    getStreamingUrl(album: string, song: string, range?: string): Promise<{
        stream: NodeJS.ReadableStream;
        contentLength: number;
        contentRange: string;
        fileSize: number;
    }>;
    /**
     * Generate a download URL for a song
     */
    getDownloadStream(album: string, song: string): Promise<NodeJS.ReadableStream>;
    /**
     * Generate a signed URL for a song (for temporary access)
     */
    getSignedUrl(key: string, expiresIn?: number): string;
    /**
     * List all objects in a directory
     */
    listObjects(prefix: string, delimiter?: string): Promise<AWS.S3.ListObjectsV2Output>;
    /**
     * Upload a file to R2
     */
    uploadFile(key: string, body: Buffer | string, contentType: string): Promise<AWS.S3.ManagedUpload.SendData>;
    /**
     * Delete a file from R2
     */
    deleteFile(key: string): Promise<AWS.S3.DeleteObjectOutput>;
}
export declare const r2Service: R2Service;
