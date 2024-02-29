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
import { HddIcon } from "@patternfly/react-icons";

import { Button, Flex, FlexItem, PageBreadcrumb } from "@patternfly/react-core";

import { SettingsDropdown } from "./settings-dropdown.jsx";

function useHostname() {
    const [hostname, setHostname] = React.useState<string | null>(null);

    React.useEffect(() => {
        const client = cockpit.dbus('org.freedesktop.hostname1');
        const hostname1 = client.proxy('org.freedesktop.hostname1', '/org/freedesktop/hostname1');

        function changed() {
            if (hostname1.valid && typeof hostname1.Hostname === 'string') {
                setHostname(hostname1.Hostname);
            }
        }

        hostname1.addEventListener("changed", changed);
        return () => {
            hostname1.removeEventListener("changed", changed);
            client.close();
        };
    }, []);

    return hostname;
}

// eslint-disable-next-line max-len
export function NavigatorBreadcrumbs({ path, showHidden, setShowHidden }: { path: string[], showHidden: boolean, setShowHidden: React.Dispatch<React.SetStateAction<boolean>>}) {
    const hostname = useHostname();

    function navigate(n_parts: number) {
        cockpit.location.go("/", { path: encodeURIComponent(path.slice(0, n_parts).join("/")) });
    }

    const fullPath = path.slice(1);
    fullPath.unshift(hostname || "server");

    return (
        <PageBreadcrumb stickyOnBreakpoint={{ default: "top" }}>
            <Flex spaceItems={{ default: "spaceItemsXs" }}>
                {fullPath.map((dir, i) => {
                    return (
                        <React.Fragment key={dir || "/"}>
                            <Button
                              isDisabled={i === path.length - 1}
                              icon={i === 0 ? <HddIcon /> : null}
                              variant="link" onClick={() => { navigate(i + 1) }}
                              key={dir} className="breadcrumb-button"
                            >
                                {dir || "/"}
                            </Button>
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
