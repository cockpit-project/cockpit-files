export const Category = Object.freeze({
    FILE: 0,
    ARCHIVE: 1,
    AUDIO: 2,
    CODE: 3,
    IMAGE: 4,
    TEXT: 5,
    VIDEO: 6,
});

/**
 * @export @typedef {{
 *   name: string,
 *   class: string
 * }} CategoryMetadata;
 */

/**
 * @typedef {{
 *   categories: Record<number, CategoryMetadata>;
 *   extensions: Record<string, number>;
 *   max_extension_length: number;
 * }} FileTypeData;
 */

/**
 * Look up the category metadata for a given filename.
 *
 * @param {FileTypeData} filetype_data
 * @param {string} name
 * @returns {CategoryMetadata}
 */
export function filetype_lookup(filetype_data, name) {
    // Never find a dot at offset '0' (the one for a hidden file), or one that
    // would produce an extension that we know not to be in the database.
    let offset = Math.max(1, name.length - filetype_data.max_extension_length - 1);

    // Allow finding extensions like '.tar.gz' (prefer longest first)
    while ((offset = name.indexOf('.', offset)) > 0) {
        offset++;
        const ext = name.substring(offset);
        if (ext in filetype_data.extensions) {
            return filetype_data.categories[filetype_data.extensions[ext]];
        }
    }

    return filetype_data.categories[Category.FILE];
}
