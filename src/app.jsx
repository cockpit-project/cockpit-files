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

import cockpit from 'cockpit';
import React, { useEffect, useState } from 'react';
import { Button, Card, CardBody, CardTitle, CardHeader, Dropdown, DropdownItem, DropdownList, Flex, FlexItem, Icon, MenuToggle, Page, PageBreadcrumb, PageSection, SearchInput } from "@patternfly/react-core";
import { ArrowLeftIcon, ArrowRightIcon, EllipsisVIcon, FileIcon, FolderIcon, ListIcon, PficonHistoryIcon } from "@patternfly/react-icons";

const _ = cockpit.gettext;

// TODO: refresh automatically when files change
export const Application = () => {
    const [currentUser, setCurrentUser] = useState("");
    const [currentFilter, setCurrentFilter] = useState("");
    const [files, setFiles] = useState([]);
    const [path, setPath] = useState([]);
    const [pathIndex, setPathIndex] = useState(0);

    const onFilterChange = (_, value) => setCurrentFilter(value);

    // TODO: Start navigator on user home directory
    useEffect(() => {
        cockpit.user().then(user => {
            setCurrentUser(user.name || "");
        })
                .then(() => {
                    const currentPath = path.slice(0, pathIndex).join("/");
                    cockpit.spawn(["ls", "-p", `/${currentPath}`], { superuser: true }).then((res) => {
                        res = res.split("\n");
                        setFiles(res.slice(0, res.length - 1));
                    });
                });
    }, [currentUser, path, pathIndex]);

    return (
        <Page>
            <NavigatorBreadcrumbs path={path} setPath={setPath} pathIndex={pathIndex} setPathIndex={setPathIndex} />
            <PageSection>
                <Card>
                    <NavigatorCardHeader currentFilter={currentFilter} onFilterChange={onFilterChange} />
                    <NavigatorCardBody currentFilter={currentFilter} files={files} setPath={setPath} path={path} pathIndex={pathIndex} setPathIndex={setPathIndex} />
                </Card>
            </PageSection>
        </Page>
    );
};

const NavigatorBreadcrumbs = ({ path, setPath, pathIndex, setPathIndex }) => {
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
        setPath(path.slice(0, i + 1));
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
                    <Button variant="secondary">
                        <PficonHistoryIcon />
                    </Button>
                </FlexItem>
                <FlexItem>
                    <Flex spaceItems={{ default: "spaceItemsXs" }}>
                        {/* TODO: adjust spacing */}
                        <Button variant='link' onClick={() => { navigateBreadcrumb(0) }} className='breadcrumb-button'>/</Button>
                        {path.slice(0, pathIndex).map((dir, i) => {
                            return (
                                <React.Fragment key={dir}>
                                    <Button variant='link' onClick={() => { navigateBreadcrumb(i + 1) }} key={dir} className='breadcrumb-button'>{dir}</Button>
                                    <p key={i} className='breadcrumb-button'>/</p>
                                </React.Fragment>
                            );
                        })}
                    </Flex>
                </FlexItem>
            </Flex>
        </PageBreadcrumb>
    );
};

const NavigatorCardHeader = ({ currentFilter, onFilterChange }) => {
    return (
        <CardHeader>
            <CardTitle component="h2">{_("Directories & files")}</CardTitle>
            <Flex flexWrap={{ default: 'nowrap' }}>
                <SearchInput placeholder={_("Filter directory")} value={currentFilter} onChange={onFilterChange} />
                <ViewSelector />
                <DropdownWithKebab />
            </Flex>
        </CardHeader>
    );
};

const NavigatorCardBody = ({ currentFilter, files, setPath, path, pathIndex, setPathIndex }) => {
    const onDoubleClickNavigate = (dir, path, file) => {
        if (dir) {
            setPath([...path.slice(0, pathIndex), file]);
            setPathIndex(pathIndex + 1);
        }
    };

    return (
        <CardBody>
            <Flex id="folder-view">
                {files.map((file) => {
                    const directory = file.substring(file.length - 1) === "/";
                    if (directory)
                        file = file.substring(0, file.length - 1);

                    if (file.toLowerCase().includes(currentFilter.toLowerCase())) {
                        return (
                            <Flex key={file} direction={{ default: "column" }} spaceItems={{ default: 'spaceItemsNone' }}>
                                <FlexItem alignSelf={{ default: "alignSelfCenter" }}>
                                    <Button variant="plain" onDoubleClick={ () => onDoubleClickNavigate(directory, path, file)}>
                                        <Icon size="xl">
                                            {directory
                                                ? <FolderIcon />
                                                : <FileIcon />}
                                        </Icon>
                                    </Button>
                                </FlexItem>
                                <FlexItem alignSelf={{ default: "alignSelfCenter" }}>{file}</FlexItem>
                            </Flex>
                        );
                    } else {
                        return null;
                    }
                })}
            </Flex>
        </CardBody>
    );
};

const DropdownWithKebab = () => {
    const [isOpen, setIsOpen] = useState(false);
    const onToggleClick = () => {
        setIsOpen(!isOpen);
    };
    const onSelect = (_event, itemId) => {
        setIsOpen(false);
    };

    return (
        <Dropdown
            isPlain
            isOpen={isOpen}
            onSelect={onSelect}
            onOpenChange={isOpen => setIsOpen(isOpen)}
            toggle={toggleRef =>
                <MenuToggle ref={toggleRef} variant="plain" onClick={onToggleClick} isExpanded={isOpen}>
                    <EllipsisVIcon />
                </MenuToggle>}
        >
            <DropdownList>
                <DropdownItem itemId='create-directory' key="create-directory">
                    {_("Create new directory")}
                </DropdownItem>
            </DropdownList>
        </Dropdown>
    );
};

export const ViewSelector = () => {
    const [isOpen, setIsOpen] = useState(false);
    const onToggleClick = isOpen => setIsOpen(!isOpen);
    const onSelect = () => setIsOpen(false);
    return (
        <Dropdown
            isOpen={isOpen}
            onSelect={onSelect}
            onOpenChange={setIsOpen}
            toggle={toggleRef => <MenuToggle ref={toggleRef} onClick={() => { onToggleClick(isOpen) }} isExpanded={isOpen} variant="secondary" splitButtonOptions={{ variant: "action", items: [<Icon key="list-icon"><ListIcon /></Icon>] }} />}
        >
            <DropdownList>
                <DropdownItem itemId="az" key="az">
                    {_("A-Z")}
                </DropdownItem>
                <DropdownItem itemId="za" key="za">
                    {_("Z-A")}
                </DropdownItem>
                <DropdownItem itemId="last_modified" key="last_modified">
                    {_("Last modified")}
                </DropdownItem>
                <DropdownItem itemId="first_modified" key="first_modified">
                    {_("First modified")}
                </DropdownItem>
            </DropdownList>
        </Dropdown>
    );
};
