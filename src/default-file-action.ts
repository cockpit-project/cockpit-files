/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2026 Red Hat, Inc.
 */

import cockpit from "cockpit";

const _ = cockpit.gettext;

// Internal names follow the double-click gesture; the UI calls this "Default file
// action" since Enter on a selected file runs the same path.
export type DefaultFileAction = "download" | "prefer-editor" | "ask";

const SETTINGS_KEY = "files:defaultFileAction";

export const DEFAULT_FILE_ACTIONS: DefaultFileAction[] = ["download", "prefer-editor", "ask"];

function isDefaultFileAction(x: unknown): x is DefaultFileAction {
    return typeof x === "string" && (DEFAULT_FILE_ACTIONS as string[]).includes(x);
}

export function loadDefaultFileAction(): DefaultFileAction | null {
    const value = localStorage.getItem(SETTINGS_KEY);
    return isDefaultFileAction(value) ? value : null;
}

export function saveDefaultFileAction(action: DefaultFileAction): void {
    localStorage.setItem(SETTINGS_KEY, action);
}

export function actionName(action: DefaultFileAction): string {
    switch (action) {
    case "download":
        return _("Download");
    case "prefer-editor":
        return _("Prefer editor");
    case "ask":
        return _("Ask");
    }
}
