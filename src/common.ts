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

import cockpit from "cockpit";

const _ = cockpit.gettext;

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

export const inode_types = {
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

export function * map_permissions<T>(func: (value: number, label: string) => T) {
    for (const [value, label] of permissions.entries()) {
        yield func(value, label);
    }
}
