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
import React, { useEffect, useState } from "react";

import { Button, Flex, FlexItem, PageBreadcrumb } from "@patternfly/react-core";
import { ArrowLeftIcon, ArrowRightIcon } from "@patternfly/react-icons";

export const NavigatorBreadcrumbs = ({ currentDir, path, history, setHistory, historyIndex, setHistoryIndex }) => {
    const [hostnameData, setHostnameData] = useState(undefined);

    useEffect(() => {
        const client = cockpit.dbus('org.freedesktop.hostname1');
        const hostnameProxy = client.proxy('org.freedesktop.hostname1', '/org/freedesktop/hostname1');
        hostnameProxy.addEventListener("changed", data => {
            setHostnameData(data.detail);
        });
    }, []);

    const hostnameText = () => {
        if (!hostnameData)
            return undefined;

        const pretty_hostname = hostnameData.PrettyHostname;
        const static_hostname = hostnameData.StaticHostname;
        let str = hostnameData.Hostname;
        if (pretty_hostname && static_hostname && static_hostname !== pretty_hostname)
            str = pretty_hostname + " (" + static_hostname + ")";
        else if (static_hostname)
            str = static_hostname;

        return str || '';
    };

    const navigateBack = () => {
        if (historyIndex > 0) {
            cockpit.location.go("/", { path: encodeURIComponent(history[historyIndex - 1].join("/")) });
            setHistoryIndex(i => i - 1);
        }
    };

    const navigateForward = () => {
        if (historyIndex < history.length) {
            cockpit.location.go("/", { path: encodeURIComponent(history[historyIndex + 1].join("/")) });
            setHistoryIndex(i => i + 1);
        }
    };

    const navigateBreadcrumb = (i) => {
        setHistory(h => [...h.slice(0, historyIndex + 1), path.slice(0, i)]);
        setHistoryIndex(i => i + 1);
        cockpit.location.go("/", { path: encodeURIComponent(path.slice(0, i).join("/")) });
    };

    return (
        <PageBreadcrumb stickyOnBreakpoint={{ default: "top" }}>
            <Flex>
                <FlexItem>
                    <Button
                      variant="secondary" onClick={navigateBack}
                      isDisabled={historyIndex === 0} id="navigate-back"
                    >
                        <ArrowLeftIcon />
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Button
                      variant="secondary" onClick={navigateForward}
                      isDisabled={history.length === historyIndex + 1} id="navigate-forward"
                    >
                        <ArrowRightIcon />
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Flex spaceItems={{ default: "spaceItemsXs" }}>
                        {path.map((dir, i) => {
                            console.log(dir);
                            return (
                                <React.Fragment key={dir || hostnameText()}>
                                    {i !== path.length - 1 &&
                                        <Button
                                          variant="link" onClick={() => { navigateBreadcrumb(i + 1) }}
                                          key={dir} className="breadcrumb-button"
                                        >
                                            {dir || hostnameText()}
                                        </Button>}
                                    {i === path.length - 1 &&
                                    <p className="last-breadcrumb-button">{dir || hostnameText()}</p>}
                                    <p key={i}>/</p>
                                </React.Fragment>
                            );
                        })}
                    </Flex>
                </FlexItem>
            </Flex>
        </PageBreadcrumb>
    );
};
