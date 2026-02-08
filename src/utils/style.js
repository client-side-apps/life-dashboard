export function getThemeColor(variableName) {
    return getComputedStyle(document.body).getPropertyValue(variableName).trim();
}

export const ChartColors = {
    Primary: '--primary-color',
    Secondary: '--secondary-color',
    Accent: '--accent-color',
    Red: '--chart-red',
    Green: '--chart-green',
    Blue: '--chart-blue',
    Cyan: '--chart-cyan',
    Magenta: '--chart-magenta',
    Yellow: '--chart-yellow',
    PrimaryText: '--primary-text'
};

export function getChartColor(colorKey) {
    const varName = ChartColors[colorKey] || colorKey;
    return getThemeColor(varName);
}
