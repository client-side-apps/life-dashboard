import { BaseImporter } from '../base-importer.js';

/**
 * Imports tweets from a Twitter/X archive (the `tweets.js` file found in the
 * archive's `data/` folder). The file is JavaScript assigning an array to
 * `window.YTD.tweets.part0`; DataImporter strips that prefix and passes the
 * parsed array here. Each item wraps the tweet under a `tweet` property.
 */
export class TwitterImporter extends BaseImporter {
    static get source() {
        return 'twitter';
    }

    static detect(jsonData) {
        if (!Array.isArray(jsonData) || jsonData.length === 0) return false;
        const first = jsonData[0];
        const tweet = first && (first.tweet || first);
        return !!(tweet && typeof tweet === 'object' && 'full_text' in tweet && 'created_at' in tweet);
    }

    static getTable() {
        return 'posts';
    }

    static extractItems(jsonData) {
        if (!Array.isArray(jsonData)) return [];
        return jsonData.map(item => item.tweet || item);
    }

    static mapRow(tweet) {
        if (!tweet || !tweet.created_at || !tweet.full_text) return null;

        // Twitter dates look like 'Wed Oct 10 20:19:24 +0000 2018'.
        const timestamp = new Date(tweet.created_at).getTime();
        if (isNaN(timestamp)) return null;

        return {
            timestamp: timestamp,
            text: tweet.full_text,
            post_id: tweet.id_str || null,
            likes: tweet.favorite_count != null ? Number(tweet.favorite_count) : null,
            reposts: tweet.retweet_count != null ? Number(tweet.retweet_count) : null,
            reply_to: tweet.in_reply_to_screen_name || null,
            lang: tweet.lang || null,
            source: 'twitter'
        };
    }
}
