// 1-bit pixel icons in the spirit of classic Mac OS, drawn on a 12x12 grid.
// '#' marks a filled pixel. Icons render with currentColor so they follow the theme.
const ICON_BITMAPS = {
    // Walking boot
    steps: [
        '............',
        '..##........',
        '..###.......',
        '..#.#.......',
        '..#.#.......',
        '..#.##......',
        '..#..###....',
        '..#....###..',
        '..#......##.',
        '..#.......#.',
        '..##########',
        '............'
    ],
    // Crescent moon
    sleep: [
        '............',
        '....####....',
        '...##..##...',
        '..##....#...',
        '..#.........',
        '.##.........',
        '.##.........',
        '..#.........',
        '..##....#...',
        '...##..##...',
        '....####....',
        '............'
    ],
    // Fork and knife
    nutrition: [
        '............',
        '.#.#.#..##..',
        '.#.#.#..##..',
        '.#.#.#..##..',
        '.#####..##..',
        '...#....##..',
        '...#....#...',
        '...#....#...',
        '...#....#...',
        '...#....#...',
        '...#....#...',
        '............'
    ],
    // Bathroom scale with display window
    weight: [
        '............',
        '.##########.',
        '#..........#',
        '#...####...#',
        '#...#..#...#',
        '#...####...#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '.##########.',
        '............'
    ],
    // Beamed eighth notes
    music: [
        '............',
        '...########.',
        '...########.',
        '...#......#.',
        '...#......#.',
        '...#......#.',
        '...#......#.',
        '.###....###.',
        '####...####.',
        '####...####.',
        '.##.....##..',
        '............'
    ],
    // Dive mask with strap
    dive: [
        '............',
        '............',
        '#..######..#',
        '###......###',
        '.#........#.',
        '.#..#..#..#.',
        '.#........#.',
        '..#..##..#..',
        '...##..##...',
        '............',
        '............',
        '............'
    ],
    // Pencil
    note: [
        '............',
        '.........##.',
        '........#..#',
        '.......#..#.',
        '......#..#..',
        '.....#..#...',
        '....#..#....',
        '...#..#.....',
        '..#..#......',
        '.#..#.......',
        '.####.......',
        '.##.........'
    ]
};

/**
 * Returns an inline SVG string for the given pixel icon name.
 * Consecutive pixels of a row are merged into a single rect.
 */
export function icon(name) {
    const bitmap = ICON_BITMAPS[name];
    if (!bitmap) return '';

    const rects = [];
    bitmap.forEach((row, y) => {
        let x = 0;
        while (x < row.length) {
            if (row[x] === '#') {
                let width = 1;
                while (row[x + width] === '#') width++;
                rects.push(`<rect x="${x}" y="${y}" width="${width}" height="1"/>`);
                x += width;
            } else {
                x++;
            }
        }
    });

    return `<svg class="pixel-icon" viewBox="0 0 12 12" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}
