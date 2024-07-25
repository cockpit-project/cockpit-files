/* This is an esbuild plugin that creates a JSON blob mapping extensions to
 * file types at bundling time.
 *
 * We do this instead of including the raw information because the raw
 * information contains a lot of things we don't need and is structured in a
 * way that makes it difficult to perform the lookup we're interested in:
 * mapping extension to file type.
 *
 * We use mime-db for images, audio, video, and text.  In order to distinguish
 * source code from other kinds of text, we use the 'language-map' data, which
 * is the same database GitHub uses to show which languages are in use in a
 * repository.  Archives are not handled well by either of those sources, so we
 * include our own list (scraped from Wikipedia).
 *
 * The `create_filetype_data()` function returns the data in the correct
 * format.  The `FileTypePlugin` is responsible for making sure that this data
 * is available to anyone who does an `import` of `./filetype-data`.  This is
 * done as a loader, but instead of loading the data from disk, it's computed.
 * That means that the data will end up in the bundle, but is never in the src/
 * directory.
 *
 * The lookup side of this all lives in 'filetype-lookup.ts'.  It can be used
 * with the data imported from './filetype-data' or it can be used directly
 * with the return value of the `create_filetype_data()` function`.
 */

import { Plugin, PluginBuild } from "esbuild";
import language_map from "language-map";
import mime_db from "mime-db/db.json";

import { Category, FileTypeData } from "./filetype-lookup";

export function create_filetype_data(): FileTypeData {
    const categories = {
        [Category.FILE]: { name: "Unknown type", class: "file" },
        [Category.ARCHIVE]: { name: "Archive file", class: "archive-file" },
        [Category.AUDIO]: { name: "Audio file", class: "audio-file" },
        [Category.CODE]: { name: "Source code file", class: "code-file" },
        [Category.IMAGE]: { name: "Image file", class: "image-file" },
        [Category.TEXT]: { name: "Text file", class: "text-file" },
        [Category.VIDEO]: { name: "Video file", class: "video-file" },
    } as const;

    const extensions: { [ext: string]: Category } = {};
    let max_extension_length = 0;

    function add_category_extensions(category: Category, exts: string[]) {
        for (let ext of exts) {
            if (ext[0] === ".") {
                ext = ext.substring(1);
            }

            max_extension_length = Math.max(max_extension_length, ext.length);
            extensions[ext] = category;
        }
    }

    // Broad-stroke categorization based on 'mime-db' package
    for (const [mimetype, details] of Object.entries(mime_db)) {
        if ("extensions" in details) {
            if (mimetype.startsWith("image/")) {
                add_category_extensions(Category.IMAGE, details.extensions);
            } else if (mimetype.startsWith("audio/")) {
                add_category_extensions(Category.AUDIO, details.extensions);
            } else if (mimetype.startsWith("video/")) {
                add_category_extensions(Category.VIDEO, details.extensions);
            } else if (mimetype.startsWith("text/")) {
                add_category_extensions(Category.TEXT, details.extensions);
            }
        }
    }

    // Archives, scraped from https://en.wikipedia.org/wiki/List_of_archive_formats
    add_category_extensions(Category.ARCHIVE, [
        "7z",
        "F",
        "LBR",
        "Z",
        "a",
        "aar",
        "ace",
        "afa",
        "alz",
        "apk",
        "ar",
        "arc",
        "arc",
        "arj",
        "ark",
        "b1",
        "b6z",
        "ba",
        "bh",
        "br",
        "bz2",
        "cab",
        "car",
        "cdx",
        "cfs",
        "cpio",
        "cpt",
        "dar",
        "dd",
        "dgc",
        "ear",
        "gca",
        "genozip",
        "genozip",
        "gz",
        "ha",
        "hki",
        "ice",
        "iso",
        "jar",
        "kgb",
        "lbr",
        "lha",
        "lz",
        "lz4",
        "lzh",
        "lzma",
        "lzo",
        "lzx",
        "mar",
        "pak",
        "paq6",
        "paq7",
        "paq8",
        "partimg",
        "pea",
        "phar",
        "pim",
        "pit",
        "qda",
        "rar",
        "rk",
        "rz",
        "s7z",
        "sbx",
        "sda",
        "sea",
        "sen",
        "sfark",
        "sfx",
        "shar",
        "shk",
        "sit",
        "sitx",
        "sqx",
        "sz",
        "tar",
        "tar.Z",
        "tar.bz2",
        "tar.gz",
        "tar.lz",
        "tar.xz",
        "tar.zst",
        "tbz2",
        "tgz",
        "tlz",
        "txz",
        "uc",
        "uc0",
        "uc2",
        "uca",
        "ucn",
        "ue2",
        "uha",
        "ur2",
        "war",
        "wim",
        "xar",
        "xp3",
        "xz",
        "yz1",
        "z",
        "zip",
        "zipx",
        "zoo",
        "zpaq",
        "zst",
        "zz",
    ]);

    // Special treatment for programming languages based on GitHub's database
    for (const lang of Object.values(language_map)) {
        if (lang.type === "programming" && "extensions" in lang) {
            add_category_extensions(Category.CODE, lang.extensions);
        }
    }

    return { categories, extensions, max_extension_length };
}

export class FileTypePlugin implements Plugin {
    name = "cockpit-files-filetype-plugin";

    setup(build: PluginBuild) {
        build.onResolve({ filter: /^\.\/filetype-data$/ }, (args) => ({
            path: args.path,
            namespace: "cockpit-files-filetype-plugin",
        }));

        build.onLoad(
            { filter: /.*/, namespace: "cockpit-files-filetype-plugin" },
            () => ({
                contents: JSON.stringify(create_filetype_data()),
                loader: "json",
            }),
        );
    }
}

export const filetype_plugin = new FileTypePlugin();
