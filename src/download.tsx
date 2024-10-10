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

import cockpit from 'cockpit';

import type { FolderFileInfo } from './app.ts';

export function downloadFile(currentPath: string, selected: FolderFileInfo) {
    const payload = JSON.stringify({
        payload: "fsread1",
        binary: "raw",
        path: `${currentPath}/${selected.name}`,
        superuser: "try",
        host: cockpit.transport.host,
        external: {
            "content-disposition": `attachment; filename="${selected.name}"`,
            "content-type": "application/octet-stream",
        }
    });

    const encodedPayload = new TextEncoder().encode(payload);
    const query = window.btoa(String.fromCharCode(...encodedPayload));

    const prefix = (new URL(cockpit.transport.uri("channel/" + cockpit.transport.csrf_token))).pathname;
    window.open(`${prefix}?${query}`);
}
