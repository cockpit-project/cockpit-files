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

/* eslint-disable no-restricted-globals */

import cockpit from "cockpit";
import React from "react";

import { Button, Flex, FlexItem, PageBreadcrumb } from "@patternfly/react-core";
import { ArrowLeftIcon, ArrowRightIcon } from "@patternfly/react-icons";

export const NavigatorBreadcrumbs = ({ path, historyIndex, setHistoryIndex }) => {
    const navigateBack = () => {
        if (historyIndex.current > 0) {
            history.back();
            history.replaceState({ index: historyIndex.current }, "");
            setHistoryIndex(i => ({ length: i.length, current: i.current - 1 }));
        }
    };

    const navigateForward = () => {
        if ((historyIndex.current + 1) < historyIndex.length) {
            history.forward();
            history.replaceState({ index: historyIndex.current }, "");
            setHistoryIndex(i => ({ length: i.length, current: i.current + 1 }));
        }
    };

    const navigateBreadcrumb = (i) => {
        cockpit.location.go("?path=root/" + path.slice(0, i).join("/"));
        if (historyIndex.current + 1 === historyIndex.length)
            setHistoryIndex(i => ({ length: i.length + 1, current: i.length }));
        else
            setHistoryIndex(i => ({ length: i.current + 2, current: i.current + 1 }));
    };

    return (
        <PageBreadcrumb stickyOnBreakpoint={{ default: "top" }}>
            <Flex>
                <FlexItem>
                    <Button
                      variant="secondary" onClick={navigateBack}
                      isDisabled={historyIndex.current === 0} id="navigate-back"
                    >
                        <ArrowLeftIcon />
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Button
                      variant="secondary" onClick={navigateForward}
                      isDisabled={historyIndex.current + 1 === historyIndex.length} id="navigate-forward"
                    >
                        <ArrowRightIcon />
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Flex spaceItems={{ default: "spaceItemsXs" }}>
                        <Button
                          variant="link" onClick={() => { navigateBreadcrumb(0) }}
                          className="breadcrumb-button"
                        >/
                        </Button>
                        {path.map((dir, i) => {
                            return (
                                <React.Fragment key={dir}>
                                    {i !== path.length - 1 &&
                                        <Button
                                          variant="link" onClick={() => { navigateBreadcrumb(i + 1) }}
                                          key={dir} className="breadcrumb-button"
                                        >
                                            {dir}
                                        </Button>}
                                    {i === path.length - 1 && <p className="last-breadcrumb-button">{dir}</p>}
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
