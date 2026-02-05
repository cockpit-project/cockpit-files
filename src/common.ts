/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2023 Red Hat, Inc.
 */
import React, { useContext } from "react";

import type { AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert";

import cockpit from "cockpit";
import type { FileInfo } from "cockpit/fsinfo.ts";

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
