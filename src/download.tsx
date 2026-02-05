/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2017 Red Hat, Inc.
 */

import cockpit from 'cockpit';

import type { FolderFileInfo } from './common.ts';

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
        },
        // HACK: The Cockpit bridge has no way of saying "unlimited" until it supports passing -1
        // https://github.com/cockpit-project/cockpit/pull/21556
        max_read_size: Number.MAX_SAFE_INTEGER,
    });

    const encodedPayload = new TextEncoder().encode(payload);
    const query = window.btoa(String.fromCharCode(...encodedPayload));

    const prefix = (new URL(cockpit.transport.uri("channel/" + cockpit.transport.csrf_token))).pathname;
    window.open(`${prefix}?${query}`);
}
