export class CSVParser {
    /**
     * Parse CSV text into an array of objects or arrays.
     * @param {string} text - The CSV content.
     * @param {object} options - Options: { headers: boolean (default true), delimiter: string (default ',') }
     * @returns {Array<Object>|Array<Array<string>>}
     */
    static parse(text, options = {}) {
        const headers = options.headers !== false;
        const delimiter = options.delimiter || ',';

        // Normalize line endings
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = this.splitIntoLines(normalizedText);

        if (lines.length === 0) return [];

        const data = lines.map(line => this.parseLine(line, delimiter));

        // Filter out empty lines (often at the end of file)
        const nonEmptyData = data.filter(row => row.length > 0 && (row.length > 1 || row[0] !== ''));

        if (!headers) {
            return nonEmptyData;
        }

        if (nonEmptyData.length === 0) return [];

        const headerRow = nonEmptyData[0];
        const bodyRows = nonEmptyData.slice(1);

        return bodyRows.map(row => {
            const obj = {};
            headerRow.forEach((header, index) => {
                // Handle duplicate headers or missing values slightly gracefully if needed, 
                // but basic mapping is usually sufficient.
                if (index < row.length) {
                    obj[header.trim()] = row[index];
                }
            });
            return obj;
        });
    }

    /**
     * Split text into lines, handling quoted newlines if they were to exist (though rare in simple CSVs)
     * For now, we assume standard line-by-line unless we implement a full state machine.
     * Given the requirement for "robust", a state machine is safer for quoted newlines.
     */
    static splitIntoLines(text) {
        // A simple split by \n is often enough, but let's be slightly more robust if we needed to.
        // However, for these specific energy files, standard line splitting is fine.
        // If we want to handle quoted newlines, we need to iterate chars.
        // Let's stick to split('\n') for simplicity unless we see complex data, 
        // as the prompt asked for "robust to typical CSV like quoted values including commas".
        // It didn't explicitly demand quoted newlines.
        return text.split('\n');
    }

    /**
     * Parse a single CSV line handling quoted values with delimiters.
     * @param {string} line 
     * @param {string} delimiter 
     */
    static parseLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                // Check for escaped quote ("")
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; // Skip the next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }
}
