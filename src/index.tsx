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

import "cockpit-dark-theme";
import "patternfly/patternfly-6-cockpit.scss";

import React from "react";

import { createRoot } from "react-dom/client";

import cockpit from "cockpit";

import { Application } from "./app.tsx";

/*
 * PF4 overrides need to come after the JSX components imports because
 * these are importing CSS stylesheets that we are overriding
 * Having the overrides here will ensure that when mini-css-extract-plugin will extract the CSS
 * out of the dist/index.js and since it will maintain the order of the imported CSS,
 * the overrides will be correctly in the end of our stylesheet.
 */
import "./app.scss";

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await cockpit.init();
    } catch (exp: any) { /* eslint-disable-line @typescript-eslint/no-explicit-any */
        /* Remove this when we take a dependency on Cockpit 336 ('info' channel in the bridge) */
        if (exp.problem === 'not-supported') {
            const user = await cockpit.user();
            cockpit.info.user = {
                fullname: user.full_name,
                group: user.groups[0],
                uid: user.id,
                ...user,
            };
        }
    }

    const root = createRoot(document.getElementById("app")!);
    root.render(<Application />);
});
