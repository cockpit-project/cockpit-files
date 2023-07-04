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

import * as timeformat from "timeformat";
import cockpit from 'cockpit';
import { useDialogs } from "dialogs.jsx";
import React, { useEffect, useState, useRef } from 'react';
import {
    Button,
    Card, CardBody, CardTitle, CardHeader,
    DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription, Dropdown, DropdownList, DropdownItem,
    Flex, FlexItem,
    Icon,
    MenuItem, MenuList, MenuToggle, MenuToggleAction,
    Page, PageBreadcrumb, PageSection,
    SearchInput, Select, SelectList, SelectOption, Sidebar, SidebarPanel, SidebarContent,
    Text, TextContent, TextVariants,
} from "@patternfly/react-core";
import { ArrowLeftIcon, ArrowRightIcon, EllipsisVIcon, FileIcon, FolderIcon, GripVerticalIcon, ListIcon } from "@patternfly/react-icons";

import { ListingTable } from "cockpit-components-table.jsx";
import { ContextMenu } from "./navigator-context-menu";
import { createDirectory, deleteItem } from "./fileActions";

const _ = cockpit.gettext;

export const Application = () => {
    const Dialogs = useDialogs();
    const [currentFilter, setCurrentFilter] = useState("");
    const [files, setFiles] = useState([]);
    const [isGrid, setIsGrid] = useState(true);
    const [path, setPath] = useState(undefined);
    const [pathIndex, setPathIndex] = useState(0);
    const [sortBy, setSortBy] = useState("az");
    const channel = useRef(null);
    const [selected, setSelected] = useState(null);
    const [selectedContext, setSelectedContext] = useState(null);

    const onFilterChange = (_, value) => setCurrentFilter(value);

    useEffect(() => {
        cockpit.user().then(user => {
            const userPath = user.home.split("/").slice(1);
            setPath(userPath);
            setPathIndex(userPath.length);
        });
    }, []);

    useEffect(() => {
        if (path === undefined)
            return;

        setSelected(path[path.length - 1]);

        const getFsList = () => {
            if (channel.current !== null)
                channel.current.close();

            const currentPath = path.slice(0, pathIndex).join("/");
            channel.current = cockpit.channel({
                payload: "fslist1",
                path: `/${currentPath}`,
                superuser: "try",
                watch: true,
            });

            const files = [];
            channel.current.addEventListener("message", (ev, data) => {
                const item = JSON.parse(data);
                if (item.event === "present") {
                    files.push({ ...item, name: item.path, isHidden: item.path.startsWith(".") });
                } else {
                    const name = item.path.slice(item.path.lastIndexOf("/") + 1);
                    if (item.event === 'deleted') {
                        setFiles(f => f.filter(res => res.name !== name));
                    } else {
                        // For events other than 'present' we don't receive file stat information
                        // so we rerun the fslist command to get the updated information
                        // https://github.com/allisonkarlitskaya/systemd_ctypes/issues/56
                        const name = item.path.slice(item.path.lastIndexOf("/") + 1);
                        if (name[0] !== ".") {
                            getFsList();
                        }
                    }
                }
            });

            channel.current.addEventListener("ready", () => {
                setFiles(files);
            });
        };
        getFsList();
    }, [path, pathIndex]);

    if (!path)
        return null;

    const visibleFiles = files.filter(file => !file.name.startsWith("."));

    const contextMenuItems = (
        <MenuList>
            <MenuItem className="context-menu-option" onClick={() => { createDirectory(Dialogs, "/" + path.join("/") + "/") }}>
                <div className="context-menu-name"> {_("Create directory")}</div>
            </MenuItem>
            {selectedContext &&
            <MenuItem className="context-menu-option pf-m-danger" onClick={() => { deleteItem(Dialogs, { selected: selectedContext, itemPath: "/" + path.join("/") + "/" + selectedContext.name }) }}>
                <div className="context-menu-name"> {selectedContext.type === "file" ? _("Delete file") : _("Delete directory") } </div>
            </MenuItem>}
        </MenuList>
    );

    return (
        <Page>
            <NavigatorBreadcrumbs path={path} setPath={setPath} pathIndex={pathIndex} setPathIndex={setPathIndex} />
            <PageSection id="navigator-page" onContextMenu={() => setSelectedContext(null)}>
                <Sidebar isPanelRight hasGutter>
                    <SidebarPanel className="sidebar-panel" width={{ default: "width_25" }}>
                        <SidebarPanelDetails path={path} selected={files.find(file => file.name === selected) || ({ name: path[path.length - 1], items_cnt: { all: files.length, hidden: files.length - visibleFiles.length } })} setPath={setPath} setPathIndex={setPathIndex} />
                    </SidebarPanel>
                    <SidebarContent>
                        <Card>
                            <NavigatorCardHeader currentFilter={currentFilter} onFilterChange={onFilterChange} isGrid={isGrid} setIsGrid={setIsGrid} sortBy={sortBy} setSortBy={setSortBy} />
                            <NavigatorCardBody currentFilter={currentFilter} files={visibleFiles} setPath={setPath} path={path} setPathIndex={setPathIndex} isGrid={isGrid} sortBy={sortBy} setSelected={setSelected} setSelectedContext={setSelectedContext} />
                            <ContextMenu parentId="navigator-page" contextMenuItems={contextMenuItems} setSelectedContext={setSelectedContext} />
                        </Card>
                    </SidebarContent>
                </Sidebar>
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

const NavigatorCardHeader = ({ currentFilter, onFilterChange, isGrid, setIsGrid, sortBy, setSortBy }) => {
    return (
        <CardHeader>
            <CardTitle component="h2" id="navigator-card-header">{_("Directories & files")}</CardTitle>
            <Flex flexWrap={{ default: 'nowrap' }} alignItems={{ default: 'alignItemsCenter' }}>
                <SearchInput placeholder={_("Filter directory")} value={currentFilter} onChange={onFilterChange} />
                <ViewSelector isGrid={isGrid} setIsGrid={setIsGrid} setSortBy={setSortBy} sortBy={sortBy} />
            </Flex>
        </CardHeader>
    );
};

const NavigatorCardBody = ({ currentFilter, files, isGrid, setPath, path, setPathIndex, sortBy, setSelected, setSelectedContext }) => {
    const onDoubleClickNavigate = (path, file) => {
        if (file.type === "directory") {
            setPath(p => [...p, file.name]);
            setPathIndex(p => p + 1);
        }
    };

    const resetSelected = e => {
        if (e.target.id === "folder-view" || e.target.id === "navigator-card-body")
            setSelected(null);
    };

    const filteredFiles = files
            .filter(file => {
                return file.name.toLowerCase().includes(currentFilter.toLowerCase());
            });

    let compare;
    switch (sortBy) {
    case "az":
        compare = (a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        break;
    case "za":
        compare = (a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? -1 : 1;
        break;
    case "last_modified":
        compare = (a, b) => a.modified > b.modified ? -1 : 1;
        break;
    case "first_modified":
        compare = (a, b) => a.modified < b.modified ? -1 : 1;
        break;
    default:
        break;
    }

    const sortedFiles = filteredFiles.sort(compare);

    const Item = ({ file }) => {
        return (
            <Button data-item={file.name} variant="plain" onDoubleClick={ () => onDoubleClickNavigate(path, file)} onClick={() => setSelected(file.name)} onContextMenu={(e) => { e.stopPropagation(); setSelectedContext(file) }} className={'item-button ' + (file.type === "directory" ? "directory-item" : "file-item")}>
                <Flex direction={{ default: isGrid ? "column" : "row" }} spaceItems={{ default: isGrid ? 'spaceItemsNone' : 'spaceItemsMd' }}>
                    <FlexItem alignSelf={{ default: "alignSelfCenter" }}>
                        <Icon size={isGrid ? "xl" : "lg"}>
                            {file.type === "directory"
                                ? <FolderIcon />
                                : <FileIcon />}
                        </Icon>
                    </FlexItem>
                    <FlexItem className={"pf-u-text-break-word pf-u-text-wrap" + (isGrid ? " grid-file-name" : "")}>
                        {file.name}
                    </FlexItem>
                </Flex>
            </Button>
        );
    };

    if (isGrid) {
        return (
            <CardBody onClick={resetSelected} id="navigator-card-body">
                <Flex id="folder-view">
                    {sortedFiles.map(file => <Item file={file} key={file.name} />)}
                </Flex>
            </CardBody>
        );
    } else {
        return (
            <ListingTable
                id="folder-view"
                className="pf-m-no-border-rows"
                variant="compact"
                columns={[_("Name")]}
                rows={filteredFiles.map(file => ({ columns: [{ title: <Item file={file} key={file.name} /> }] }))}
            />
        );
    }
};

const SidebarPanelDetails = ({ selected, path, setPath, setPathIndex }) => {
    return (
        <Card className="sidebar-card">
            <CardHeader>
                <CardTitle component="h2" id="sidebar-card-header">
                    <TextContent>
                        <Text>{selected.name}</Text>
                        {selected.items_cnt !== undefined &&
                        <Text component={TextVariants.small}>
                            {cockpit.format(cockpit.ngettext("$0 item $1", "$0 items $1", selected.items_cnt.all), selected.items_cnt.all, cockpit.format("($0 hidden)", selected.items_cnt.hidden))}
                        </Text>}
                    </TextContent>
                </CardTitle>
                <DropdownWithKebab selected={selected} path={path} setPath={setPath} setPathIndex={setPathIndex} />
            </CardHeader>
            {selected.items_cnt === undefined &&
            <CardBody>
                <DescriptionList isHorizontal>
                    <DescriptionListGroup id="description-list-last-modified">
                        <DescriptionListTerm>{_("Last modified")}</DescriptionListTerm>
                        <DescriptionListDescription>{timeformat.dateTime(selected.modified * 1000)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup id="description-list-owner">
                        <DescriptionListTerm>{_("Owner")}</DescriptionListTerm>
                        <DescriptionListDescription>{selected.owner}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup id="description-list-group">
                        <DescriptionListTerm>{_("Group")}</DescriptionListTerm>
                        <DescriptionListDescription>{selected.group}</DescriptionListDescription>
                    </DescriptionListGroup>
                    {selected.type === "file" &&
                    <DescriptionListGroup id="description-list-size">
                        <DescriptionListTerm>{_("Size")}</DescriptionListTerm>
                        <DescriptionListDescription>{cockpit.format("$0 $1", cockpit.format_bytes(selected.size), selected.size < 1000 ? "B" : "")}</DescriptionListDescription>
                    </DescriptionListGroup>}
                </DescriptionList>
            </CardBody>}
        </Card>
    );
};

export const ViewSelector = ({ isGrid, setIsGrid, sortBy, setSortBy }) => {
    const [isOpen, setIsOpen] = useState(false);
    const onToggleClick = isOpen => setIsOpen(!isOpen);
    const onSelect = (ev, itemId) => {
        setIsOpen(false);
        setSortBy(itemId);
    };

    return (
        <Select
            id='sort-menu'
            isOpen={isOpen}
            selected={sortBy}
            onSelect={onSelect}
            onOpenChange={setIsOpen}
            popperProps={{ position: "right" }}
            toggle={toggleRef => (
                <MenuToggle
                    id='sort-menu-toggle'
                    className="view-toggle-group"
                    isExpanded={isOpen}
                    onClick={() => onToggleClick(isOpen)}
                    ref={toggleRef}
                    splitButtonOptions={{
                        variant: "action",
                        items: [
                            <MenuToggleAction
                                aria-label={isGrid ? _("Display as a list") : _("Display as a grid")}
                                key="view-toggle-action"
                                onClick={() => setIsGrid(!isGrid)}
                            >
                                {isGrid ? <ListIcon className="view-toggle-icon" /> : <GripVerticalIcon className="view-toggle-icon" />}
                            </MenuToggleAction>
                        ]
                    }}
                    variant="secondary"
                />
            )}
        >
            <SelectList>
                <SelectOption itemId="az">{_("A-Z")}</SelectOption>
                <SelectOption itemId="za">{_("Z-A")}</SelectOption>
                <SelectOption itemId="last_modified">{_("Last modified")}</SelectOption>
                <SelectOption itemId="first_modified">{_("First modified")}</SelectOption>
            </SelectList>
        </Select>
    );
};

const DropdownWithKebab = ({ selected, path, setPath, setPathIndex }) => {
    const Dialogs = useDialogs();
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
            onOpenChange={setIsOpen}
            popperProps={{ position: "right" }}
            toggle={toggleRef =>
                <MenuToggle ref={toggleRef} variant="plain" onClick={onToggleClick} isExpanded={isOpen} id="dropdown-menu">
                    <EllipsisVIcon />
                </MenuToggle>}
        >
            <DropdownList>
                <DropdownItem id="create-item" key="create-item" onClick={() => { createDirectory(Dialogs, "/" + path.join("/") + "/") }}>
                    {_("Create directory")}
                </DropdownItem>
                <DropdownItem id="delete-item" key="delete-item" onClick={() => { deleteItem(Dialogs, { selected, itemPath: "/" + path.join("/") + "/" + (selected.items_cnt ? "" : selected.name), path, setPath, setPathIndex }) }} className="pf-m-danger">
                    {selected.type === "file" ? _("Delete file") : _("Delete directory")}
                </DropdownItem>
            </DropdownList>
        </Dropdown>
    );
};
