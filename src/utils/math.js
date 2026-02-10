
/**
 * Calculates a simple moving average for an array of numbers.
 * If any value in the window is null or undefined (missing), the average for that window is null.
 *
 * @param {Array<number|null>} data - The input data array.
 * @param {number} windowSize - The size of the moving window.
 * @returns {Array<number|null>} The calculated moving averages.
 */
export function calculateMovingAverage(data, windowSize) {
    const avgData = [];
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        let hasMissing = false;

        // check window [i - windowSize + 1, i]
        for (let j = 0; j < windowSize; j++) {
            const idx = i - j;
            if (idx >= 0) {
                if (data[idx] === null || data[idx] === undefined) {
                    hasMissing = true;
                    break;
                }
                sum += Number(data[idx]);
                count++;
            }
        }

        if (!hasMissing && count > 0) {
            avgData.push(sum / count);
        } else {
            avgData.push(null);
        }
    }
    return avgData;
}
