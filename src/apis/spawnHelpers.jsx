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
