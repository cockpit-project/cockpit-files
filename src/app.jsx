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
import { useDialogs } from "dialogs.jsx";
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
    Button,
    Card, CardBody,
    Flex, FlexItem,
    Icon,
    MenuItem, MenuList,
    Page, PageSection,
    Sidebar, SidebarPanel, SidebarContent, Truncate,
} from "@patternfly/react-core";
import { FileIcon, FolderIcon } from "@patternfly/react-icons";

import { ListingTable } from "cockpit-components-table.jsx";
import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { ContextMenu } from "./navigatorContextMenu.jsx";
import { NavigatorBreadcrumbs } from "./navigatorBreadcrumbs.jsx";
import { createDirectory, createLink, deleteItem, editPermissions, renameItem } from "./fileActions.jsx";
import { SidebarPanelDetails } from "./sidebar.jsx";
import { NavigatorCardHeader } from "./header.jsx";

const _ = cockpit.gettext;

const updateFile = (file, currentPath) => {
    const filePath = currentPath + "/" + file.name;
    return cockpit.spawn(["stat", "-c", "%a,%Y,%G,%U,%s", filePath], { superuser: "try", error: "message" })
            .then(res => {
                res = res.trim().split(",");

                let perm = res[0];
                // trim sticky bit
                if (perm.length === 4) perm = perm.slice(1);
                if (perm.length === 1) perm = "00".concat(perm);
                if (perm.length === 2) perm = "0".concat(perm);
                file.permissions = perm;

                file.modified = res[1];
                file.group = res[2];
                file.owner = res[3];
                file.size = res[4];
                return file;
            }, exc => console.error("Adding file failed", file, exc));
};

export const Application = () => {
    const Dialogs = useDialogs();
    const [loading, setLoading] = useState(true);
    const [currentFilter, setCurrentFilter] = useState("");
    const [files, setFiles] = useState([]);
    const [isGrid, setIsGrid] = useState(true);
    const [path, setPath] = useState(undefined);
    const [sortBy, setSortBy] = useState(localStorage.getItem("cockpit-navigator.sort") || "az");
    const channel = useRef(null);
    const channelList = useRef(null);
    const [selected, setSelected] = useState(null);
    const [selectedContext, setSelectedContext] = useState(null);
    const [showHidden, setShowHidden] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const onFilterChange = (_, value) => setCurrentFilter(value);

    useEffect(() => {
        cockpit.user().then(user => {
            const userPath = user.home.split("/").slice(1);
            setPath(userPath);
            setHistory(h => [...h, userPath]);
        });
    }, []);

    const getFsList = useCallback(() => {
        const _files = [];
        const currentPath = path.join("/");

        if (channelList.current !== null)
            channelList.current.close();

        channelList.current = cockpit.channel({
            payload: "fslist1",
            path: `/${currentPath}`,
            superuser: "try",
            watch: false,
        });

        channelList.current.addEventListener("message", (ev, data) => {
            const file = JSON.parse(data);

            _files.push({ ...file, name: file.path, isHidden: file.path.startsWith(".") });
        });

        channelList.current.addEventListener("close", () => {
            Promise.all(_files.map(file => updateFile(file, currentPath)))
                    .then(() => {
                        setFiles(_files);
                        setLoading(false);
                    });
        });
    }, [path]);

    const watchFiles = useCallback(() => {
        if (path === undefined)
            return;

        const currentPath = path.join("/");

        if (channel.current !== null)
            channel.current.close();

        channel.current = cockpit.channel({
            payload: "fswatch1",
            path: `/${currentPath}`,
            superuser: "try",
        });

        channel.current.addEventListener("message", (ev, data) => {
            const item = JSON.parse(data);

            item.name = item.path.slice(item.path.lastIndexOf("/") + 1);
            item.isHidden = item.name.startsWith(".");

            // When files are created with some file editor we get also 'attribute-changed' and
            // 'done-hint' events which are handled below. We should not add the same file twice.
            if (item.event === "created" && item.type === "directory") {
                updateFile(item, currentPath).then(file => {
                    setFiles(_f => [..._f, file]);
                });
            } else {
                if (item.event === "deleted") {
                    setFiles(f => f.filter(res => res.name !== item.name));
                } else {
                    // For events other than 'present' we don't receive file stat information
                    // so we rerun the fslist command to get the updated information
                    // https://github.com/allisonkarlitskaya/systemd_ctypes/issues/56
                    if (item.name[0] !== ".") {
                        getFsList();
                    }
                }
            }
        });
    }, [path, getFsList]);

    useEffect(() => {
        if (path === undefined)
            return;

        setSelected(path[path.length - 1]);
        setFiles([]);
        setLoading(true);

        watchFiles();
        getFsList();
    }, [path, getFsList, watchFiles]);

    if (!path || loading)
        return <EmptyStatePanel loading />;

    const visibleFiles = !showHidden ? files.filter(file => !file.isHidden) : files;

    const contextMenuItems = (
        <MenuList>
            <MenuItem className="context-menu-option" onClick={() => { createDirectory(Dialogs, "/" + path.join("/") + "/", selectedContext || selected) }}>
                <div className="context-menu-name"> {_("Create directory")}</div>
            </MenuItem>
            <MenuItem className="context-menu-option" onClick={() => { createLink(Dialogs, "/" + path.join("/") + "/", files, selectedContext) }}>
                <div className="context-menu-name"> {_("Create link")}</div>
            </MenuItem>
            {selectedContext &&
            <>
                <MenuItem className="context-menu-option" onClick={() => { navigator.clipboard.writeText("/" + path.join("/") + "/" + selectedContext.name) }}>
                    <div className="context-menu-name"> {_("Copy full path")} </div>
                </MenuItem>
                <MenuItem className="context-menu-option" onClick={() => { renameItem(Dialogs, { selected: selectedContext, path, setPath }) }}>
                    <div className="context-menu-name"> {selectedContext.type === "file" ? _("Rename file") : _("Rename directory")} </div>
                </MenuItem>
                <MenuItem className="context-menu-option" onClick={() => { editPermissions(Dialogs, { selected: selectedContext, path, setPath }) }}>
                    <div className="context-menu-name"> {_("Edit properties")} </div>
                </MenuItem>
                <MenuItem className="context-menu-option pf-m-danger" onClick={() => { deleteItem(Dialogs, { selected: selectedContext, itemPath: "/" + path.join("/") + "/" + selectedContext.name }) }}>
                    <div className="context-menu-name"> {selectedContext.type === "file" ? _("Delete file") : _("Delete directory")} </div>
                </MenuItem>
            </>}
        </MenuList>
    );

    return (
        <Page>
            <NavigatorBreadcrumbs
              path={path} setPath={setPath}
              setHistory={setHistory} history={history}
              historyIndex={historyIndex} setHistoryIndex={setHistoryIndex}
            />
            <PageSection onContextMenu={() => { setSelectedContext(null); setSelected(path[path.length - 1]) }}>
                <Sidebar isPanelRight hasGutter>
                    <SidebarPanel className="sidebar-panel" width={{ default: "width_25" }}>
                        <SidebarPanelDetails
                          path={path} selected={(files.find(file => file.name === selected?.name)) || ({ name: path[path.length - 1], items_cnt: { all: files.length, hidden: files.length - files.filter(file => !file.name.startsWith(".")).length } })}
                          setPath={setPath} showHidden={showHidden}
                          setShowHidden={setShowHidden} setHistory={setHistory}
                          setHistoryIndex={setHistoryIndex} files={files}
                        />
                    </SidebarPanel>
                    <SidebarContent>
                        <Card>
                            <NavigatorCardHeader
                              currentFilter={currentFilter} onFilterChange={onFilterChange}
                              isGrid={isGrid} setIsGrid={setIsGrid}
                              sortBy={sortBy} setSortBy={setSortBy}
                            />
                            <NavigatorCardBody
                              currentFilter={currentFilter} files={visibleFiles}
                              setPath={setPath} path={path}
                              isGrid={isGrid} sortBy={sortBy}
                              selected={selected} setSelected={setSelected}
                              setSelectedContext={setSelectedContext} setHistory={setHistory}
                              setHistoryIndex={setHistoryIndex} historyIndex={historyIndex}
                            />
                            <ContextMenu
                              parentId="folder-view" contextMenuItems={contextMenuItems}
                              setSelectedContext={setSelectedContext}
                            />
                        </Card>
                    </SidebarContent>
                </Sidebar>
            </PageSection>
        </Page>
    );
};

const NavigatorCardBody = ({ currentFilter, files, isGrid, setPath, path, sortBy, selected, setSelected, setSelectedContext, setHistory, historyIndex, setHistoryIndex }) => {
    const onDoubleClickNavigate = (path, file) => {
        if (file.type === "directory") {
            setPath(p => [...p, file.name]);
            setHistory(h => [...h.slice(0, historyIndex + 1), [...path, file.name]]);
            setHistoryIndex(h => h + 1);
        }
    };

    const resetSelected = e => {
        if (e.target.id === "folder-view" || e.target.id === "navigator-card-body")
            setSelected(path[path.length - 1]);
    };

    const filteredItems = files
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

    const filteredFolders = filteredItems.filter((item) => (item.type === "directory"));
    // filtered files can be files, links or special files
    const filteredFiles = filteredItems.filter((item) => (item.type !== "directory"));
    const sortedFiles = filteredFolders.sort(compare).concat(filteredFiles.sort(compare));

    const Item = ({ file }) => {
        return (
            <Button
              data-item={file.name} variant="plain"
              onDoubleClick={() => onDoubleClickNavigate(path, file)} onClick={() => setSelected(file)}
              onContextMenu={(e) => { e.stopPropagation(); setSelectedContext(file) }} className={"item-button " + (file.type === "directory" ? "directory-item" : "file-item")}
            >
                <Flex direction={{ default: isGrid ? "column" : "row" }} spaceItems={{ default: isGrid ? "spaceItemsNone" : "spaceItemsMd" }}>
                    <FlexItem alignSelf={{ default: "alignSelfCenter" }}>
                        <Icon size={isGrid ? "xl" : "lg"} isInline>
                            {file.type === "directory"
                                ? <FolderIcon />
                                : <FileIcon />}
                        </Icon>
                    </FlexItem>
                    <FlexItem className={"pf-u-text-break-word pf-u-text-wrap" + (isGrid ? " grid-file-name" : "")}>
                        {selected?.name !== file.name ? <Truncate content={file.name} position="middle" /> : file.name}
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
              rows={sortedFiles.map(file => ({ columns: [{ title: <Item file={file} key={file.name} /> }] }))}
            />
        );
    }
};
