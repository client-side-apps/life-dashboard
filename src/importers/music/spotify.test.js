
import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { SpotifyImporter } from './spotify.js';

describe('SpotifyImporter', () => {
    const sampleData = [
        {
            "ts": "2023-06-17T18:28:50Z",
            "platform": "android",
            "ms_played": 160768,
            "conn_country": "US",
            "ip_addr": "172.102.8.5",
            "master_metadata_track_name": "A Friend Like You",
            "master_metadata_album_artist_name": "Gabby's Dollhouse",
            "master_metadata_album_album_name": "A Friend Like You",
            "spotify_track_uri": "spotify:track:1V9uZoVhNlFAhV8uS0gC4l",
            "episode_name": null,
            "episode_show_name": null,
            "spotify_episode_uri": null,
            "audiobook_title": null,
            "audiobook_uri": null,
            "audiobook_chapter_uri": null,
            "audiobook_chapter_title": null,
            "reason_start": "trackdone",
            "reason_end": "trackdone",
            "shuffle": false,
            "skipped": false,
            "offline": false,
            "offline_timestamp": 1687026369,
            "incognito_mode": false
        }
    ];

    it('detects spotify data', () => {
        assert.strictEqual(SpotifyImporter.detect(sampleData), true);
        assert.strictEqual(SpotifyImporter.detect([]), false);
        assert.strictEqual(SpotifyImporter.detect([{ foo: 'bar' }]), false);
    });

    it('maps row correctly', () => {
        const mapped = SpotifyImporter.mapRow(sampleData[0]);
        assert.ok(mapped);
        assert.strictEqual(mapped.timestamp, new Date("2023-06-17T18:28:50Z").getTime());
        assert.strictEqual(mapped.track_name, "A Friend Like You");
        assert.strictEqual(mapped.artist_name, "Gabby's Dollhouse");
        assert.strictEqual(mapped.album_name, "A Friend Like You");
        assert.strictEqual(mapped.track_uri, "spotify:track:1V9uZoVhNlFAhV8uS0gC4l");
        assert.strictEqual(mapped.duration_ms, 160768);
        assert.strictEqual(mapped.platform, 'android');
        assert.strictEqual(mapped.source, 'spotify');
    });

    it('returns null for invalid row', () => {
        const invalidRow = { ...sampleData[0] };
        delete invalidRow.ts;
        const mapped = SpotifyImporter.mapRow(invalidRow);
        assert.strictEqual(mapped, null);
    });

    it('maps podcast episodes instead of dropping them', () => {
        const podcastRow = {
            ...sampleData[0],
            master_metadata_track_name: null,
            master_metadata_album_artist_name: null,
            master_metadata_album_album_name: null,
            spotify_track_uri: null,
            episode_name: 'Episode 42',
            episode_show_name: 'My Favorite Show',
            spotify_episode_uri: 'spotify:episode:abc123'
        };
        const mapped = SpotifyImporter.mapRow(podcastRow);
        assert.ok(mapped, 'Podcast play should be imported');
        assert.strictEqual(mapped.track_name, 'Episode 42');
        assert.strictEqual(mapped.artist_name, 'My Favorite Show');
        assert.strictEqual(mapped.track_uri, 'spotify:episode:abc123');
        assert.strictEqual(mapped.duration_ms, 160768);
    });

    it('maps audiobook chapters instead of dropping them', () => {
        const audiobookRow = {
            ...sampleData[0],
            master_metadata_track_name: null,
            spotify_track_uri: null,
            audiobook_title: 'A Great Book',
            audiobook_uri: 'spotify:show:book1',
            audiobook_chapter_title: 'Chapter 3',
            audiobook_chapter_uri: 'spotify:episode:chap3'
        };
        const mapped = SpotifyImporter.mapRow(audiobookRow);
        assert.ok(mapped, 'Audiobook play should be imported');
        assert.strictEqual(mapped.track_name, 'Chapter 3');
        assert.strictEqual(mapped.artist_name, 'A Great Book');
        assert.strictEqual(mapped.track_uri, 'spotify:episode:chap3');
    });
});
