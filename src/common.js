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
    { label: _("None"), value: "0" },
    { label: _("Read-only"), value: "4" },
    { label: _("Write-only"), value: "2" },
    { label: _("Execute-only"), value: "1" },
    { label: _("Read and write"), value: "6" },
    { label: _("Read and execute"), value: "5" },
    { label: _("Read, write and execute"), value: "7" },
    { label: _("Write and execute"), value: "3" },
];

export const inode_types = {
    directory: _("Directory"),
    file: _("Regular file"),
    link: _("Symbolic link"),
    special: _("Special file"),
};
