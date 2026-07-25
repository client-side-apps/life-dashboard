import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CSVParser } from './csv-parser.js';

describe('CSVParser', () => {

    it('parses simple rows with headers', () => {
        const rows = CSVParser.parse('a,b\n1,2\n3,4');
        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[0].a, '1');
        assert.strictEqual(rows[1].b, '4');
    });

    it('parses quoted values containing commas', () => {
        const rows = CSVParser.parse('name,desc\nfoo,"hello, world"');
        assert.strictEqual(rows[0].desc, 'hello, world');
    });

    it('parses escaped quotes inside quoted values', () => {
        const rows = CSVParser.parse('name,desc\nfoo,"say ""hi"" now"');
        assert.strictEqual(rows[0].desc, 'say "hi" now');
    });

    it('keeps newlines inside quoted values instead of splitting the row', () => {
        const rows = CSVParser.parse('name,desc\nfoo,"line one\nline two"\nbar,plain');
        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[0].desc, 'line one\nline two');
        assert.strictEqual(rows[1].name, 'bar');
        assert.strictEqual(rows[1].desc, 'plain');
    });

    it('handles CRLF files with quoted newlines', () => {
        const rows = CSVParser.parse('name,desc\r\nfoo,"line one\r\nline two"\r\n');
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].desc, 'line one\nline two');
    });
});
