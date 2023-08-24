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
import React from "react";

import { ForceDeleteModal } from "../fileActions";

const options = { err: "message", superuser: "try" };

const renameCommand = ({ selected, path, name }) => {
    return selected.items_cnt
        ? ["mv", path.join("/"), path.slice(0, -1).join("/") + "/" + name]
        : ["mv", path.join("/") + "/" + selected.name, path.join("/") + "/" + name];
};

export const spawnDeleteItem = ({ path, selected, itemPath, Dialogs, setSelected, setHistory, setHistoryIndex }) => {
    cockpit.spawn([
        "rm",
        "-r",
        ...selected.length > 1
            ? selected.map(f => path + f.name)
            : [itemPath]
    ], options)
            .then(() => {
                setSelected([]);
                if (selected.length === 0) {
                    const newPath = path.slice(0, -1).join("/");

                    cockpit.location.go("/", { path: encodeURIComponent(newPath) });
                    setHistory(h => h.slice(0, -1));
                    setHistoryIndex(i => i - 1);
                }
            })
            .then(Dialogs.close, err => {
                Dialogs.show(
                    <ForceDeleteModal
                      selected={selected} itemPath={itemPath}
                      initialError={err.message}
                    />
                );
            });
};

export const spawnForceDelete = ({ selected, path, itemPath, Dialogs, setDeleteFailed, setErrorMessage }) => {
    cockpit.spawn([
        "rm",
        "-r",
        ...selected.length > 1
            ? selected.map(f => path + f.name)
            : [itemPath]
    ], options)
            .then(Dialogs.close, err => {
                setDeleteFailed(true);
                setErrorMessage(err.message);
            });
};

export const spawnRenameItem = ({ selected, name, path, Dialogs, setErrorMessage, setHistory, setHistoryIndex }) => {
    const newPath = selected.items_cnt
        ? path.slice(0, -1).join("/") + "/" + name
        : path.join("/") + "/" + name;

    cockpit.spawn(renameCommand({ selected, path, name }), options)
            .then(() => {
                if (selected.items_cnt) {
                    cockpit.location.go("/", { path: encodeURIComponent(newPath) });
                    setHistory(h => h.slice(0, -1));
                    setHistoryIndex(i => i - 1);
                }
                Dialogs.close();
            }, err => setErrorMessage(err.message));
};

export const spawnCreateDirectory = ({ name, currentPath, selected, Dialogs, setErrorMessage }) => {
    let path;
    if (selected.icons_cnt || selected.type === "directory") {
        path = currentPath + selected.name + "/" + name;
    } else {
        path = currentPath + name;
    }
    cockpit.spawn(["mkdir", path], options)
            .then(Dialogs.close, err => setErrorMessage(err.message));
};

export const spawnCreateLink = ({ type, currentPath, originalName, newName, Dialogs, setErrorMessage }) => {
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

// eslint-disable-next-line max-len
export const spawnEditPermissions = ({ changeAll, ownerAccess, groupAccess, otherAccess, name, path, selected, owner, group, Dialogs, setErrorMessage }) => {
    const command = [
        "chmod",
        ...(changeAll
            ? ["-R"]
            : []),
        ownerAccess + groupAccess + otherAccess,
        path.join("/") + "/" + selected.name
    ];
    const permissionChanged = (
        ownerAccess !== selected.permissions[0] ||
        groupAccess !== selected.permissions[1] ||
        otherAccess !== selected.permissions[2]
    );
    const ownerChanged = owner !== selected.owner || group !== selected.group;
    const nameChanged = name !== selected.name;

    Promise.resolve()
            .then(() => {
                if (permissionChanged)
                    return cockpit.spawn(command, options);
            })
            .then(() => {
                if (ownerChanged) {
                    return cockpit.spawn(
                        ["chown", owner + ":" + group, path.join("/") + "/" + selected.name],
                        options
                    );
                }
            })
            .then(() => {
                if (nameChanged)
                    return cockpit.spawn(renameCommand({ selected, path, name }), options);
            })
            .then(Dialogs.close, err => setErrorMessage(err.message));
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
