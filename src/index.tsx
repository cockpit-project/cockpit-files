/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2017 Red Hat, Inc.
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
