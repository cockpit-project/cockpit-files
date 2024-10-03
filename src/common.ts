/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2023 Red Hat, Inc.
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
import React, { useContext } from "react";

import type { AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert";

import cockpit from "cockpit";
import type { FileInfo } from "cockpit/fsinfo.ts";
import { usePageLocation } from "hooks";

const _ = cockpit.gettext;

export interface FolderFileInfo extends FileInfo {
    name: string,
    to: string | null,
    category: { class: string } | null,
}

export interface ClipboardInfo {
    path: string,
    files: FolderFileInfo[];
}

interface FilesContextType {
    addAlert: (title: string, variant: AlertVariant, key: string, detail?: string | React.ReactNode,
               actionLinks?: React.ReactNode) => void,
    removeAlert: (key: string) => void,
    cwdInfo: FileInfo | null,
}

export const FilesContext = React.createContext({
    addAlert: () => console.warn("FilesContext not initialized"),
    removeAlert: () => console.warn("FilesContext not initialized"),
    cwdInfo: null,
} as FilesContextType);

export const useFilesContext = () => useContext(FilesContext);

export const usePath = () => {
    const { options } = usePageLocation();
    let currentPath = decodeURIComponent(options.path?.toString() || "/");

    // Trim all trailing slashes
    currentPath = currentPath.replace(/\/+$/, '');

    // Our path will always be `/foo/` formatted
    if (!currentPath.endsWith("/")) {
        currentPath += "/";
    }

    if (!currentPath.startsWith("/")) {
        currentPath = `/${currentPath}`;
    }

    return currentPath;
};

export const permissions = [
    /* 0 */ _("None"),
    /* 1 */ _("Execute-only"),
    /* 2 */ _("Write-only"),
    /* 3 */ _("Write and execute"),
    /* 4 */ _("Read-only"),
    /* 5 */ _("Read and execute"),
    /* 6 */ _("Read and write"),
    /* 7 */ _("Read, write, and execute"),
];

export const inode_types: Record<string, string> = {
    blk: _("Block device"),
    chr: _("Character device"),
    dir: _("Directory"),
    fifo: _("Named pipe"),
    lnk: _("Symbolic link"),
    reg: _("Regular file"),
    sock: _("Socket"),
};

export function get_permissions(n: number) {
    return permissions[n & 0o7];
}

export function permissionShortStr(mode: number) {
    const specialBits = (mode >> 9) & 0b111;
    const permsStr = [];
    for (let i = 2; i >= 0; i--) {
        const offset = i * 3;
        let shortStr = "";
        shortStr += (mode & (0b1 << (offset + 2))) ? "r" : "-";
        shortStr += (mode & (0b1 << (offset + 1))) ? "w" : "-";

        if (mode & (1 << offset)) {
            if (specialBits & (0b1 << i)) {
                shortStr += (i === 0) ? "t" : "s";
            } else {
                shortStr += "x";
            }
        } else {
            if (specialBits & (0b1 << i)) {
                shortStr += (i === 0) ? "T" : "S";
            } else {
                shortStr += "-";
            }
        }

        permsStr.push(shortStr);
    }

    return permsStr.join(" ");
}

export function checkFilename(candidate: string, entries: Record<string, FileInfo>, selectedFile?: FolderFileInfo) {
    if (candidate === "") {
        return _("Name cannot be empty");
    } else if (candidate.length >= 256) {
        return _("Name too long");
    } else if (candidate.includes("/")) {
        return _("Name cannot include a /");
    } else if (selectedFile && selectedFile.name === candidate) {
        return _("Filename is the same as original name");
    } else if (candidate in entries) {
        if (entries[candidate].type === "dir") {
            return _("Directory with the same name exists");
        }
        return _("File exists");
    } else {
        return null;
    }
}

export function debug(...args: unknown[]) {
    if (window.debugging === "all" || window.debugging?.includes("files")) {
        console.debug("files:", ...args);
    }
}

export function testIsAppleDevice() {
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}
