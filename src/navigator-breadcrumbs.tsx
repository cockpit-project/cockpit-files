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

import { Button, Flex, FlexItem, PageBreadcrumb } from "@patternfly/react-core";

import { SettingsDropdown } from "./settings-dropdown.jsx";

type setShowHiddenType = typeof React.useState<boolean>

// eslint-disable-next-line max-len
export function NavigatorBreadcrumbs({ path, showHidden, setShowHidden }: { path: string[], showHidden: boolean, setShowHidden: setShowHiddenType }) {
    function navigate(n_parts: number) {
        cockpit.location.go("/", { path: encodeURIComponent(path.slice(0, n_parts).join("/")) });
    }

    return (
        <PageBreadcrumb stickyOnBreakpoint={{ default: "top" }}>
            <Flex spaceItems={{ default: "spaceItemsXs" }}>
                {path.map((dir, i) => {
                    return (
                        <React.Fragment key={dir || "/"}>
                            {i !== path.length - 1 &&
                                <Button
                                  variant="link" onClick={() => { navigate(i + 1) }}
                                  key={dir} className="breadcrumb-button"
                                >
                                    {dir || "/"}
                                </Button>}
                            {i === path.length - 1 && <p className="last-breadcrumb-button">{dir || "/"}</p>}
                            {dir !== "" && <p key={i}>/</p>}
                        </React.Fragment>
                    );
                })}
                <FlexItem align={{ default: 'alignRight' }}>
                    <SettingsDropdown showHidden={showHidden} setShowHidden={setShowHidden} />
                </FlexItem>
            </Flex>
        </PageBreadcrumb>
    );
}
