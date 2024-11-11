/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import React from "react";

import { AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert";
import { DropdownItem } from "@patternfly/react-core/dist/esm/components/Dropdown";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";

import cockpit from "cockpit";
import type { FileInfo } from "cockpit/fsinfo";
import { basename } from "cockpit-path";
import type { Dialogs } from 'dialogs';

import type { FolderFileInfo } from "./app";
import { confirm_delete } from './dialogs/delete.tsx';
import { edit_file, MAX_EDITOR_FILE_SIZE } from './dialogs/editor.tsx';
import { show_create_directory_dialog } from './dialogs/mkdir.tsx';
import { edit_permissions } from './dialogs/permissions.jsx';
import { show_rename_dialog } from './dialogs/rename.tsx';
import { downloadFile } from './download.tsx';
import { ClipboardIcon, CopyIcon } from "./icons/gnome-icons.tsx";

const _ = cockpit.gettext;

type MenuItem = { type: "divider" } | {
    type?: never,
    title: string,
    id: string,
    onClick: () => void;
    isDisabled?: boolean;
    className?: string;
};

type IconItem = {
    title: string,
    id: string,
    onClick: () => void,
    icon?: React.JSX.Element,
    isDisabled?: boolean;
    description: string,
}

export function pasteFromClipboard(
    clipboard: string[],
    cwdInfo: FileInfo | null,
    path: string,
    addAlert: (title: string, variant: AlertVariant, key: string, detail?: string) => void,
) {
    const existingFiles = clipboard.filter(sourcePath => cwdInfo?.entries?.[basename(sourcePath)]);
    if (existingFiles.length > 0) {
        addAlert(_("Pasting failed"), AlertVariant.danger, "paste-error",
                 cockpit.format(_("\"$0\" exists, not overwriting with paste."),
                                existingFiles.map(basename).join(", ")));
        return;
    }
    cockpit.spawn([
        "cp",
        "-R",
        ...clipboard,
        path
    ]).catch(err => addAlert(err.message, AlertVariant.danger, `${new Date().getTime()}`));
}

export function get_menu_items(
    path: string,
    selected: FolderFileInfo[], setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>,
    clipboard: string[], setClipboard: React.Dispatch<React.SetStateAction<string[]>>,
    cwdInfo: FileInfo | null,
    addAlert: (title: string, variant: AlertVariant, key: string, detail?: string) => void,
    dialogs: Dialogs,
): [IconItem[], MenuItem[]] {
    const iconItems: IconItem[] = [];

    const menuItems: MenuItem[] = [];

    if (selected.length === 0) {
        iconItems.push(
            {
                id: "paste-item",
                title: _("Paste"),
                isDisabled: clipboard.length === 0,
                onClick: () => pasteFromClipboard(clipboard, cwdInfo, path, addAlert),
                icon: <ClipboardIcon />,
                description: _("Paste (Ctrl + V)"),
            },
        );
        menuItems.push(
            { type: "divider" },
            {
                id: "create-item",
                title: _("Create directory"),
                onClick: () => show_create_directory_dialog(dialogs, path)
            },
            { type: "divider" },
            {
                id: "edit-permissions",
                title: _("Edit permissions"),
                onClick: () => edit_permissions(dialogs, null, path)
            }
        );
    } else if (selected.length === 1) {
        const item = selected[0];
        // Only allow code, text and unknown file types as we detect things by
        // extensions, so not allowing unknown file types would disallow one
        // from editing for example /etc/hostname
        const allowed_edit_types = ["code-file", "text-file", "file"];
        iconItems.push(
            {
                id: "copy-item",
                title: _("Copy"),
                onClick: () => setClipboard([path + item.name]),
                icon: <CopyIcon />,
                description: _("Copy (Ctrl + C)"),
            },
            {
                id: "paste-item",
                title: _("Paste"),
                isDisabled: clipboard.length === 0,
                onClick: () => pasteFromClipboard(clipboard, cwdInfo, path, addAlert),
                icon: <ClipboardIcon />,
                description: _("Paste (Ctrl + V)"),
            },
        );
        menuItems.push({ type: "divider" });
        if (item.type === 'reg' &&
            allowed_edit_types.includes(item?.category?.class || "") &&
            item.size !== undefined && item.size < MAX_EDITOR_FILE_SIZE)
            menuItems.push(
                {
                    id: "open-file",
                    title: _("Edit file"),
                    onClick: () => edit_file(dialogs, path + item.name)
                },
            );
        menuItems.push(
            {
                id: "rename-item",
                title: _("Rename"),
                onClick: () => show_rename_dialog(dialogs, path, item)
            }
        );

        if (item.type === "reg") {
            menuItems.push(
                {
                    id: "download-item",
                    title: _("Download"),
                    onClick: () => downloadFile(path, item)
                }
            );
        }

        menuItems.push(
            {
                id: "delete-item",
                title: _("Delete"),
                className: "pf-m-danger",
                onClick: () => confirm_delete(dialogs, path, [item], setSelected)
            },
            { type: "divider" },
            {
                id: "edit-permissions",
                title: _("Edit permissions"),
                onClick: () => edit_permissions(dialogs, item, path)
            },
        );
    } else if (selected.length > 1) {
        iconItems.push(
            {
                id: "copy-item",
                title: _("Copy"),
                onClick: () => setClipboard(selected.map(s => path + s.name)),
                icon: <CopyIcon />,
                description: _("Copy (Ctrl + C)"),
            },
            {
                id: "paste-item",
                title: _("Paste"),
                isDisabled: clipboard.length === 0,
                onClick: () => pasteFromClipboard(clipboard, cwdInfo, path, addAlert),
                icon: <ClipboardIcon />,
                description: _("Paste (Ctrl + V)"),
            },
        );
        menuItems.push(
            { type: "divider" },
            {
                id: "delete-item",
                title: _("Delete"),
                className: "pf-m-danger",
                onClick: () => confirm_delete(dialogs, path, selected, setSelected)
            }
        );
    }

    return [iconItems, menuItems];
}

export function makeMenuHeader (items: IconItem[]) {
    const iconItems = items.map(item => {
        return (
            <DropdownItem
              key={item.id}
              id={item.id}
              onClick={() => item.onClick()}
              isDisabled={item.isDisabled ?? false}
              tooltipProps={{ content: item.description }}
            >
                {item.icon}
            </DropdownItem>
        );
    });

    return (
        <Flex
          className="icon-menu-items"
          align={{ default: "alignLeft" }}
          justifyContent={{ default: "justifyContentFlexStart" }}
          spaceItems={{ default: "spaceItemsXs" }}
          flexWrap={{ default: "nowrap" }}
        >
            {iconItems}
        </Flex>
    );
}
