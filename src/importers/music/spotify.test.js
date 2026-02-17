
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
});
