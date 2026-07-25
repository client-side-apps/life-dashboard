
import { BaseImporter } from '../base-importer.js';

export class SpotifyImporter extends BaseImporter {
    static get source() {
        return 'spotify';
    }

    static detect(rows) {
        if (!rows || !Array.isArray(rows) || rows.length === 0) return false;
        const first = rows[0];
        // Check for specific Spotify fields
        return 'spotify_track_uri' in first && 'master_metadata_track_name' in first && 'ms_played' in first;
    }

    static getTable() {
        return 'music';
    }

    static mapRow(row) {
        if (!row.ts) return null;

        const timestamp = new Date(row.ts).getTime();
        if (isNaN(timestamp)) return null;

        // Music track
        if (row.master_metadata_track_name) {
            return {
                timestamp: timestamp,
                track_name: row.master_metadata_track_name,
                artist_name: row.master_metadata_album_artist_name,
                album_name: row.master_metadata_album_album_name,
                track_uri: row.spotify_track_uri,
                duration_ms: row.ms_played,
                platform: row.platform,
                source: 'spotify'
            };
        }

        // Podcast episode
        if (row.episode_name) {
            return {
                timestamp: timestamp,
                track_name: row.episode_name,
                artist_name: row.episode_show_name,
                album_name: row.episode_show_name,
                track_uri: row.spotify_episode_uri,
                duration_ms: row.ms_played,
                platform: row.platform,
                source: 'spotify'
            };
        }

        // Audiobook chapter
        if (row.audiobook_title) {
            return {
                timestamp: timestamp,
                track_name: row.audiobook_chapter_title || row.audiobook_title,
                artist_name: row.audiobook_title,
                album_name: row.audiobook_title,
                track_uri: row.audiobook_chapter_uri || row.audiobook_uri,
                duration_ms: row.ms_played,
                platform: row.platform,
                source: 'spotify'
            };
        }

        return null;
    }
}
