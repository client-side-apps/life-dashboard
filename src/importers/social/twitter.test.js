import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { TwitterImporter } from './twitter.js';

const samplePath = path.resolve(import.meta.dirname, '../../../data-samples/social/twitter/tweets.js');
const sampleContent = fs.readFileSync(samplePath, 'utf-8');

// Same prefix stripping DataImporter applies to window.YTD archive files.
const jsonData = JSON.parse(sampleContent.slice(sampleContent.indexOf('=') + 1));

test('detect recognizes a Twitter archive tweet list', () => {
    assert.strictEqual(TwitterImporter.detect(jsonData), true);
    assert.strictEqual(TwitterImporter.detect([]), false);
    assert.strictEqual(TwitterImporter.detect([{ ts: 'x', spotify_track_uri: 'y' }]), false);
    assert.strictEqual(TwitterImporter.detect({ semanticSegments: [] }), false);
});

test('extractItems unwraps the tweet property', () => {
    const items = TwitterImporter.extractItems(jsonData);
    assert.strictEqual(items.length, 8);
    assert.ok(items.every(t => 'full_text' in t && 'created_at' in t));
});

test('mapRow maps a tweet to the posts table', () => {
    const items = TwitterImporter.extractItems(jsonData);
    const mapped = TwitterImporter.mapRow(items[0]);

    assert.strictEqual(mapped.timestamp, Date.UTC(2025, 0, 15, 17, 30, 0));
    assert.strictEqual(mapped.text, 'Started tracking all my life data in a local-first dashboard. Neat!');
    assert.strictEqual(mapped.post_id, '1875000000000000001');
    assert.strictEqual(mapped.likes, 12);
    assert.strictEqual(mapped.reposts, 2);
    assert.strictEqual(mapped.reply_to, null);
    assert.strictEqual(mapped.lang, 'en');
    assert.strictEqual(mapped.source, 'twitter');
});

test('mapRow keeps the replied-to screen name', () => {
    const items = TwitterImporter.extractItems(jsonData);
    const reply = items.find(t => t.in_reply_to_screen_name);
    const mapped = TwitterImporter.mapRow(reply);
    assert.strictEqual(mapped.reply_to, 'afriend');
});

test('mapRow returns null for invalid rows', () => {
    assert.strictEqual(TwitterImporter.mapRow(null), null);
    assert.strictEqual(TwitterImporter.mapRow({}), null);
    assert.strictEqual(TwitterImporter.mapRow({ full_text: 'x', created_at: 'not a date' }), null);
});
