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

const options = { err: "message", superuser: "try" };

const renameCommand = (selected, path, newPath, is_current_dir) => {
    return is_current_dir
        ? ["mv", path.join("/"), newPath]
        : ["mv", path.join("/") + "/" + selected.name, newPath];
};

export const spawnRenameItem = (selected, name, path, Dialogs, setErrorMessage) => {
    const is_current_dir = path.at(-1) === selected.name;
    const newPath = is_current_dir
        ? path.slice(0, -1).join("/") + "/" + name
        : path.join("/") + "/" + name;

    cockpit.spawn(renameCommand(selected, path, newPath, is_current_dir), options)
            .then(() => {
                if (is_current_dir) {
                    cockpit.location.go("/", { path: encodeURIComponent(newPath) });
                }
                Dialogs.close();
            }, err => setErrorMessage(err.message));
};

export const spawnCreateDirectory = (name, currentPath, Dialogs, setErrorMessage) => {
    const path = currentPath + name;
    cockpit.spawn(["mkdir", path], options)
            .then(Dialogs.close, err => setErrorMessage(err.message));
};

export const spawnCreateLink = (type, currentPath, originalName, newName, Dialogs, setErrorMessage) => {
    cockpit.spawn([
        "ln",
        ...(type === "symbolic"
            ? ["-s"]
            : []),
        currentPath + originalName.slice(originalName.lastIndexOf("/") + 1),
        currentPath + newName
    ], options)
            .then(Dialogs.close, (err) => { setErrorMessage(err.message) });
};

export const spawnEditPermissions = async (mode, path, selected, owner, group, Dialogs, setErrorMessage) => {
    const permissionChanged = mode !== selected.mode;
    const ownerChanged = owner !== selected.user || group !== selected.group;

    try {
        if (permissionChanged)
            await cockpit.spawn(["chmod", mode.toString(8), path.join("/") + "/" + selected.name], options);

        if (ownerChanged)
            await cockpit.spawn(["chown", owner + ":" + group, path.join("/") + "/" + selected.name], options);

        Dialogs.close();
    } catch (err) {
        setErrorMessage(err.message);
    }
};

export const spawnPaste = (sourcePath, targetPath, asSymlink, addAlert) => {
    if (asSymlink) {
        cockpit.spawn([
            "ln",
            "-s",
            ...sourcePath,
            targetPath
        ]).catch(err => addAlert(err.message, "danger", new Date().getTime()));
    } else {
        cockpit.spawn([
            "cp",
            "-R",
            ...sourcePath,
            targetPath
        ]).catch(err => addAlert(err.message, "danger", new Date().getTime()));
    }
};
