/**
 * Helpers keeping the timeline scrollbar the size of the whole selected range,
 * even though days are rendered in batches as the user scrolls.
 */

/**
 * Height to reserve below the rendered days so the scrollbar already accounts
 * for the days still to be rendered.
 * @param {number} renderedHeight height taken by the days rendered so far, in pixels
 * @param {number} renderedDays number of days rendered so far
 * @param {number} pendingDays number of days left to render
 * @returns {number} height to reserve, in pixels
 */
export function estimatePendingHeight(renderedHeight, renderedDays, pendingDays) {
    if (pendingDays <= 0 || renderedDays <= 0 || renderedHeight <= 0) return 0;
    return Math.round((renderedHeight / renderedDays) * pendingDays);
}
