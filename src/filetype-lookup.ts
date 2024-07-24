export enum Category {
    FILE = 0,

    ARCHIVE,
    AUDIO,
    CODE,
    IMAGE,
    TEXT,
    VIDEO,
}

export interface CategoryMetadata extends Record<string, string> {
    name: string;
    class: string;
}

export interface FileTypeData {
    categories: Record<Category, CategoryMetadata>;
    extensions: Record<string, Category>;
    max_extension_length: number;
}

export function filetype_lookup(filetype_data: FileTypeData, name: string) {
    // Never find a dot at offset '0' (the one for a hidden file), or one that
    // would produce an extension that we know not to be in the database.
    let offset = Math.max(
        1,
        name.length - filetype_data.max_extension_length - 1,
    );

    // Allow finding extensions like '.tar.gz' (prefer longest first)
    while ((offset = name.indexOf(".", offset)) > 0) {
        offset++;
        const ext = name.substring(offset);
        if (ext in filetype_data.extensions) {
            return filetype_data.categories[filetype_data.extensions[ext]];
        }
    }

    return filetype_data.categories[Category.FILE];
}
