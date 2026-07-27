/**
 * Describes what the header database status indicator should show.
 *
 * The database can exist in memory without ever having been opened from a file
 * (importing data into a brand new database creates one), so the indicator is
 * driven by the database itself rather than by how it came to be.
 *
 * @param {Object} params
 * @param {boolean} params.hasDatabase Whether a database is available in memory.
 * @param {string|null} [params.fileName] Name of the file changes are written to, if any.
 * @param {boolean} [params.isDirty] Whether there are changes not written to a file.
 * @returns {{state: 'hidden'|'saved'|'unsaved'|'idle', showSaveButton: boolean, fileName: string|null}}
 */
export function describeDbStatus({ hasDatabase, fileName = null, isDirty = false }) {
    if (!hasDatabase) {
        return { state: 'hidden', showSaveButton: false, fileName: null };
    }

    if (fileName) {
        return { state: 'saved', showSaveButton: false, fileName };
    }

    if (isDirty) {
        return { state: 'unsaved', showSaveButton: true, fileName: null };
    }

    return { state: 'idle', showSaveButton: false, fileName: null };
}
