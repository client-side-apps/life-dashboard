
import { calculateMovingAverage } from '../src/utils/math.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('calculateMovingAverage', () => {

    it('should calculate moving average for a simple array', () => {
        const data = [10, 20, 30, 40, 50];
        const windowSize = 3;
        const result = calculateMovingAverage(data, windowSize);

        // Window 1: [10] -> 10
        // Window 2: [10, 20] -> 15
        // Window 3: [10, 20, 30] -> 20
        // Window 4: [20, 30, 40] -> 30
        // Window 5: [30, 40, 50] -> 40
        assert.deepStrictEqual(result, [10, 15, 20, 30, 40]);
    });

    it('should return null if window contains null', () => {
        const data = [10, 20, 30, null, 50, 60, 70];
        const windowSize = 3;
        const result = calculateMovingAverage(data, windowSize);

        // Window 1: [10] -> 10
        // Window 2: [10, 20] -> 15
        // Window 3: [10, 20, 30] -> 20
        // Window 4: [20, 30, null] -> null (missing in window)
        // Window 5: [30, null, 50] -> null (missing in window)
        // Window 6: [null, 50, 60] -> null (missing in window)
        // Window 7: [50, 60, 70] -> 60

        assert.deepStrictEqual(result, [10, 15, 20, null, null, null, 60]);
    });

    it('should handle undefined as missing', () => {
        const data = [10, undefined, 30];
        const windowSize = 2;
        const result = calculateMovingAverage(data, windowSize);

        // Window 1: [10] -> 10
        // Window 2: [10, undefined] -> null
        // Window 3: [undefined, 30] -> null

        assert.deepStrictEqual(result, [10, null, null]);
    });

    it('should handle window larger than data', () => {
        const data = [10, 20];
        const windowSize = 5;
        const result = calculateMovingAverage(data, windowSize);

        // Window 1: [10] -> 10
        // Window 2: [10, 20] -> 15

        assert.deepStrictEqual(result, [10, 15]);
    });

    it('should handle empty array', () => {
        const data = [];
        const windowSize = 3;
        const result = calculateMovingAverage(data, windowSize);
        assert.deepStrictEqual(result, []);
    });

    it('should handle all nulls', () => {
        const data = [null, null, null];
        const windowSize = 2;
        const result = calculateMovingAverage(data, windowSize);
        assert.deepStrictEqual(result, [null, null, null]);
    });
});
