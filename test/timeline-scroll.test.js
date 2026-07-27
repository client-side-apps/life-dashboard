import { test } from 'node:test';
import assert from 'node:assert';

import { estimatePendingHeight } from '../src/utils/timeline-scroll.js';

test('estimatePendingHeight extrapolates from the days rendered so far', () => {
    // 10 days taking 2000px average 200px per day, 40 days left to render.
    assert.strictEqual(estimatePendingHeight(2000, 10, 40), 8000);
    assert.strictEqual(estimatePendingHeight(1500, 10, 5), 750);
    assert.strictEqual(estimatePendingHeight(100, 3, 1), 33);
});

test('estimatePendingHeight reserves nothing without days left or measurements', () => {
    assert.strictEqual(estimatePendingHeight(2000, 10, 0), 0);
    assert.strictEqual(estimatePendingHeight(2000, 10, -1), 0);
    assert.strictEqual(estimatePendingHeight(2000, 0, 40), 0);
    assert.strictEqual(estimatePendingHeight(0, 10, 40), 0);
});

test('the reserved height keeps the total close to the fully rendered timeline', () => {
    const dayHeights = Array.from({ length: 50 }, (_, i) => 150 + (i % 7) * 30);
    const fullHeight = dayHeights.reduce((sum, height) => sum + height, 0);

    // Estimating after each batch should stay within a reasonable margin of the final height.
    for (let rendered = 10; rendered < dayHeights.length; rendered += 10) {
        const renderedHeight = dayHeights.slice(0, rendered).reduce((sum, height) => sum + height, 0);
        const estimated = renderedHeight + estimatePendingHeight(renderedHeight, rendered, dayHeights.length - rendered);
        assert.ok(Math.abs(estimated - fullHeight) / fullHeight < 0.1, `estimate ${estimated} should be close to ${fullHeight}`);
    }
});
