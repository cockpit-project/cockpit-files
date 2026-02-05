/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2017 Red Hat, Inc.
 */

import React from "react";

import { AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert";

import cockpit from "cockpit";
import type { FileInfo } from "cockpit/fsinfo";
import { basename, dirname } from "cockpit-path";
import type { Dialogs } from 'dialogs';
import { superuser } from 'superuser';

import { debug } from "./common.ts";
import type { ClipboardInfo, FolderFileInfo } from "./common.ts";
import { show_copy_paste_as_owner } from "./dialogs/copyPasteOwnership.tsx";
import { show_create_file_dialog } from './dialogs/create-file.tsx';
import { confirm_delete } from './dialogs/delete.tsx';
import { edit_file, MAX_EDITOR_FILE_SIZE } from './dialogs/editor.tsx';
import { show_create_directory_dialog } from './dialogs/mkdir.tsx';
import { edit_permissions } from './dialogs/permissions.jsx';
import { show_rename_dialog } from './dialogs/rename.tsx';
import { create_link } from "./dialogs/symlink.tsx";
import { downloadFile } from './download.tsx';

const _ = cockpit.gettext;

type MenuItem = { type: "divider" } | {
    type?: never,
    title: string,
    id: string,
    onClick: () => void;
    isDisabled?: boolean;
    className?: string;
};

export async function pasteFromClipboard(
    clipboard: ClipboardInfo,
    cwdInfo: FileInfo | null,
    path: string,
    dialogs: Dialogs,
    addAlert: (title: string, variant: AlertVariant, key: string, detail?: string) => void,
) {
    const existingFiles = clipboard.files.filter(sourcePath => cwdInfo?.entries?.[sourcePath.name]);

    if (existingFiles.length > 0) {
        addAlert(_("Pasting failed"), AlertVariant.danger, "paste-error",
                 cockpit.format(_("\"$0\" exists, not overwriting with paste."),
                                existingFiles.map(file => file.name).join(", ")));
        return;
    }

    try {
        const filePaths = clipboard.files.map(file => `${clipboard.path}/${file.name}`);
        await cockpit.spawn([
            "cp",
            "--archive",
            ...filePaths,
            path
        ]);
    } catch (e) {
        const err = e as cockpit.BasicError;
        debug("Failed to copy as admin: ", err);
        if (superuser.allowed) {
            show_copy_paste_as_owner(dialogs, clipboard, path);
        } else {
            addAlert(err.message, AlertVariant.danger, `${new Date().getTime()}`);
        }
    }
}

export function get_menu_items(
    path: string,
    selected: FolderFileInfo[], setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>,
    clipboard: ClipboardInfo, setClipboard: React.Dispatch<React.SetStateAction<ClipboardInfo>>,
    cwdInfo: FileInfo | null,
    addAlert: (title: string, variant: AlertVariant, key: string, detail?: string) => void,
    dialogs: Dialogs,
) {
    const menuItems: MenuItem[] = [];
    // @ts-expect-error: complains about terminal not existing as a property despite being json
    const supportsTerminal = cockpit.manifests.system?.tools?.terminal?.capabilities?.includes("path");

    if (selected.length === 0) {
        const current_directory = { ...cwdInfo, name: basename(path), category: null, to: null };
        const base_path = get_base_path(path);
        menuItems.push(
            {
                id: "paste-item",
                title: _("Paste"),
                isDisabled: clipboard.files.length === 0,
                onClick: () => pasteFromClipboard(clipboard, cwdInfo, path, dialogs, addAlert),
            },
            { type: "divider" },
            {
                id: "create-folder",
                title: _("Create directory"),
                onClick: () => show_create_directory_dialog(dialogs, path)
            },
            {
                id: "create-file",
                title: _("Create file"),
                onClick: () => show_create_file_dialog(dialogs, path, addAlert)
            },
            { type: "divider" },
            {
                id: "edit-permissions",
                title: _("Edit permissions"),
                onClick: () => edit_permissions(dialogs, [current_directory], base_path)
            }
        );
        if (supportsTerminal) {
            menuItems.push(
                { type: "divider" },
                {
                    id: "terminal",
                    title: _("Open in terminal"),
                    onClick: () => cockpit.jump("/system/terminal#/?path=" + encodeURIComponent(path))
                }
            );
        }
    } else if (selected.length === 1) {
        const item = selected[0];
        // Only allow code, text and unknown file types as we detect things by
        // extensions, so not allowing unknown file types would disallow one
        // from editing for example /etc/hostname
        const allowed_edit_types = ["code-file", "text-file", "file"];
        if (item.type === 'reg' &&
            allowed_edit_types.includes(item?.category?.class || "") &&
            item.size !== undefined && item.size < MAX_EDITOR_FILE_SIZE)
            menuItems.push(
                {
                    id: "open-file",
                    title: _("Open text file"),
                    onClick: () => edit_file(dialogs, path + item.name)
                },
                { type: "divider" },
            );
        menuItems.push(
            {
                id: "copy-item",
                title: _("Copy"),
                onClick: () => setClipboard({ path, files: [item] })
            },
            { type: "divider" },
            {
                id: "edit-permissions",
                title: _("Edit permissions"),
                onClick: () => edit_permissions(dialogs, [item], path)
            },
            {
                id: "rename-item",
                title: _("Rename"),
                onClick: () => show_rename_dialog(dialogs, path, item)
            },
            { type: "divider" },
            {
                id: "delete-item",
                title: _("Delete"),
                className: "pf-m-danger",
                onClick: () => confirm_delete(dialogs, path, [item], setSelected)
            },
        );
        if (item.type === "reg") {
            menuItems.push(
                { type: "divider" },
                {
                    id: "download-item",
                    title: _("Download"),
                    onClick: () => downloadFile(path, item)
                }
            );
        } else if (item.type === "dir" && supportsTerminal) {
            menuItems.push(
                { type: "divider" },
                {
                    id: "terminal",
                    title: _("Open in terminal"),
                    onClick: () => cockpit.jump("/system/terminal#/?path=" + encodeURIComponent(path + item.name))
                }
            );
        }
        if (item.type === 'reg' || item.type === "dir")
            menuItems.push(
                { type: "divider" },
                {
                    id: "create-symlink",
                    title: _("Create link"),
                    onClick: () => create_link(dialogs, path, item)
                },
            );
    } else if (selected.length > 1) {
        menuItems.push(
            {
                id: "copy-item",
                title: _("Copy"),
                onClick: () => setClipboard({ path, files: selected }),
            },
            {
                id: "delete-item",
                title: _("Delete"),
                className: "pf-m-danger",
                onClick: () => confirm_delete(dialogs, path, selected, setSelected)
            }
        );

        // Don't allow mixing regular files and folders when editing multiple
        // permissions, it can be unclear if we are changing the folders
        // permissions or the permissions of the files underneath.
        if (selected.every(sel => sel.type === "reg")) {
            menuItems.push(
                { type: "divider" },
                {
                    id: "edit-permissions",
                    title: _("Edit permissions"),
                    onClick: () => edit_permissions(dialogs, selected, path)
                }
            );
        }
    }

    return menuItems;
}

// Get the dirname based on the given path with special logic for "/", so we don't show the root directory as "//"
// As selected.name would already be "/".
function get_base_path(path: string) {
    let base_path = dirname(path);
    if (base_path === "/")
        base_path = "";
    else {
        base_path += "/";
    }

    return base_path;
}
