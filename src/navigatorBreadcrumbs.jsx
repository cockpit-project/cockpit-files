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
import React from "react";

import { Button, Flex, FlexItem, PageBreadcrumb } from "@patternfly/react-core";
import { ArrowLeftIcon, ArrowRightIcon } from "@patternfly/react-icons";

export const NavigatorBreadcrumbs = ({ path, setPath, pathIndex, setPathIndex }) => {
    const navigateBack = () => {
        if (pathIndex > 0)
            setPathIndex(pathIndex - 1);
    };

    const navigateForward = () => {
        if (pathIndex < path.length) {
            setPathIndex(pathIndex + 1);
        }
    };

    const navigateBreadcrumb = (i) => {
        setPath(path.slice(0, i));
        setPathIndex(i);
    };

    return (
        <PageBreadcrumb stickyOnBreakpoint={{ default: "top" }}>
            <Flex>
                <FlexItem>
                    <Button variant="secondary" onClick={navigateBack} isDisabled={pathIndex === 0}>
                        <ArrowLeftIcon />
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Button variant="secondary" onClick={navigateForward}>
                        <ArrowRightIcon />
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Flex spaceItems={{ default: "spaceItemsXs" }}>
                        <Button variant='link' onClick={() => { navigateBreadcrumb(0) }} className='breadcrumb-button'>/</Button>
                        {path.slice(0, pathIndex).map((dir, i) => {
                            return (
                                <React.Fragment key={dir}>
                                    {i !== path.slice(0, pathIndex).length - 1
                                        ? <Button variant='link' onClick={() => { navigateBreadcrumb(i + 1) }} key={dir} className='breadcrumb-button'>{dir}</Button>
                                        : <p className='last-breadcrumb-button'>{dir}</p>}
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
