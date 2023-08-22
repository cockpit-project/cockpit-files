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
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
    Card, CardBody,
    Flex, FlexItem,
    Icon,
    MenuItem, MenuList,
    Page, PageSection,
    Sidebar, SidebarPanel, SidebarContent, Truncate, CardHeader, CardTitle,
} from "@patternfly/react-core";
import { FileIcon, FolderIcon } from "@patternfly/react-icons";

import { ListingTable } from "cockpit-components-table.jsx";
import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { ContextMenu } from "./navigatorContextMenu.jsx";
import { NavigatorBreadcrumbs } from "./navigatorBreadcrumbs.jsx";
import { createDirectory, createLink, deleteItem, editPermissions, renameItem } from "./fileActions.jsx";
import { SidebarPanelDetails } from "./sidebar.jsx";
import { NavigatorCardHeader } from "./header.jsx";
import { usePageLocation } from "hooks.js";

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
                if (file.type === "link")
                    return cockpit.spawn(["ls", "-lF", filePath])
                            .then(res => {
                                file.to = res.slice(-2, -1) === "/"
                                    ? "directory"
                                    : "file";
                                return file;
                            });
                else
                    return file;
            }, exc => console.error("Adding file failed", file, exc));
};

export const Application = () => {
    const { options } = usePageLocation();
    const Dialogs = useDialogs();
    const [loading, setLoading] = useState(true);
    const [currentFilter, setCurrentFilter] = useState("");
    const [files, setFiles] = useState([]);
    const [isGrid, setIsGrid] = useState(true);
    const [sortBy, setSortBy] = useState(localStorage.getItem("cockpit-navigator.sort") || "az");
    const channel = useRef(null);
    const channelList = useRef(null);
    const [selected, setSelected] = useState(null);
    const [selectedContext, setSelectedContext] = useState(null);
    const [showHidden, setShowHidden] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const onFilterChange = (_, value) => setCurrentFilter(value);
    const currentPath = decodeURIComponent(options.path || "");
    const path = currentPath?.split("/").filter(Boolean);
    const currentDir = path.join("/") + "/";
    const sel = path[path.length - 1];

    useEffect(() => {
        cockpit.user().then(user => {
            const userPath = user.home.split("/").slice(1);
            setHistory(h => [...h, userPath]);

            if (options.path === undefined) {
                cockpit.location.go("/", { path: encodeURIComponent(user.home) });
            }
        });
    }, [options]);

    const getFsList = useCallback(() => {
        const _files = [];

        if (channelList.current !== null)
            channelList.current.close();

        channelList.current = cockpit.channel({
            payload: "fslist1",
            path: `/${currentDir}`,
            superuser: "try",
            watch: false,
        });

        channelList.current.addEventListener("message", (ev, data) => {
            const file = JSON.parse(data);

            _files.push({ ...file, name: file.path, isHidden: file.path.startsWith(".") });
        });

        channelList.current.addEventListener("close", () => {
            Promise.all(_files.map(file => updateFile(file, currentDir)))
                    .then(() => {
                        setFiles(_files);
                        setLoading(false);
                    });
        });
    }, [currentDir]);

    const watchFiles = useCallback(() => {
        if (channel.current !== null)
            channel.current.close();

        channel.current = cockpit.channel({
            payload: "fswatch1",
            path: `/${currentDir}`,
            superuser: "try",
        });

        channel.current.addEventListener("message", (ev, data) => {
            const item = JSON.parse(data);

            item.name = item.path.slice(item.path.lastIndexOf("/") + 1);
            item.isHidden = item.name.startsWith(".");

            // When files are created with some file editor we get also 'attribute-changed' and
            // 'done-hint' events which are handled below. We should not add the same file twice.
            if (item.event === "created" && item.type === "directory") {
                updateFile(item, currentDir).then(file => {
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
    }, [currentDir, getFsList]);

    useEffect(() => {
        if (currentPath === "")
            return;

        setSelected(sel);
        setFiles([]);
        setLoading(true);

        watchFiles();
        getFsList();
    }, [currentPath, sel, getFsList, watchFiles]);

    if (loading || path.length === 0)
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
                <MenuItem className="context-menu-option" onClick={() => { renameItem(Dialogs, { selected: selectedContext, path, setHistory, setHistoryIndex }) }}>
                    <div className="context-menu-name"> {cockpit.format(_("Rename $0"), selectedContext.type)} </div>
                </MenuItem>
                <MenuItem className="context-menu-option" onClick={() => { editPermissions(Dialogs, { selected: selectedContext, path }) }}>
                    <div className="context-menu-name"> {_("Edit properties")} </div>
                </MenuItem>
                <MenuItem className="context-menu-option pf-m-danger" onClick={() => { deleteItem(Dialogs, { selected: selectedContext, itemPath: "/" + path.join("/") + "/" + selectedContext.name, setHistory, setHistoryIndex }) }}>
                    <div className="context-menu-name"> {cockpit.format(_("Delete $0"), selectedContext.type)} </div>
                </MenuItem>
            </>}
        </MenuList>
    );

    return (
        <Page>
            <NavigatorBreadcrumbs
              path={path}
              currentDir={currentDir}
              setHistory={setHistory} history={history}
              historyIndex={historyIndex} setHistoryIndex={setHistoryIndex}
            />
            <PageSection onContextMenu={() => { setSelectedContext(null); setSelected(path[path.length - 1]) }}>
                <Sidebar isPanelRight hasGutter>
                    <SidebarPanel className="sidebar-panel" width={{ default: "width_25" }}>
                        <SidebarPanelDetails
                          path={path} selected={(files.find(file => file.name === selected?.name)) || ({ name: path[path.length - 1], items_cnt: { all: files.length, hidden: files.length - files.filter(file => !file.name.startsWith(".")).length } })}
                          setHistory={setHistory} setHistoryIndex={setHistoryIndex}
                          showHidden={showHidden}
                          setShowHidden={setShowHidden} files={files}
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
                              path={path}
                              currentDir={currentDir}
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

const compare = (sortBy) => {
    const compareFileType = (a, b) => {
        if (a.type === "directory" && b.type !== "directory")
            return -1;
        if (a.type !== "directory" && b.type === "directory")
            return 1;
        return 0;
    };

    switch (sortBy) {
    case "az":
        return (a, b) => compareFileType(a, b) === 0 ? (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) : compareFileType(a, b);
    case "za":
        return (a, b) => compareFileType(a, b) === 0 ? (a.name.toLowerCase() > b.name.toLowerCase() ? -1 : 1) : compareFileType(a, b);
    case "last_modified":
        return (a, b) => compareFileType(a, b) === 0 ? (a.modified > b.modified ? -1 : 1) : compareFileType(a, b);
    case "first_modified":
        return (a, b) => compareFileType(a, b) === 0 ? (a.modified < b.modified ? -1 : 1) : compareFileType(a, b);
    default:
        break;
    }
};

const NavigatorCardBody = ({ currentFilter, files, isGrid, path, sortBy, selected, setSelected, setSelectedContext, setHistory, historyIndex, setHistoryIndex }) => {
    const sortedFiles = useMemo(() => {
        const compareFunc = compare(sortBy);

        return files
                .filter(file => {
                    return file.name.toLowerCase().includes(currentFilter.toLowerCase());
                })
                .sort(compareFunc);
    }, [files, currentFilter, sortBy]);
    const isMounted = useRef(null);

    useEffect(() => {
        const onKeyboardNav = (e) => {
            if (e.key === "ArrowRight") {
                setSelected(_selected => {
                    const selectedIdx = sortedFiles?.findIndex(file => file.name === _selected?.name);
                    const newIdx = selectedIdx < sortedFiles.length - 1 ? selectedIdx + 1 : 0;

                    return sortedFiles[newIdx];
                });
            } else if (e.key === "ArrowLeft") {
                setSelected(_selected => {
                    const selectedIdx = sortedFiles?.findIndex(file => file.name === _selected?.name);
                    const newIdx = selectedIdx > 0 ? selectedIdx - 1 : sortedFiles.length - 1;

                    return sortedFiles[newIdx];
                });
            }
        };

        if (!isMounted.current) {
            isMounted.current = true;
            document.addEventListener("keydown", onKeyboardNav);
        }
        return () => {
            isMounted.current = false;
            document.removeEventListener("keydown", onKeyboardNav);
        };
    }, [setSelected, sortedFiles]);

    const onDoubleClickNavigate = (path, file) => {
        const newPath = [...path, file.name].join("/");
        if (file.type === "directory" || file.to === "directory") {
            setHistory(h => [...h.slice(0, historyIndex + 1), [...path, file.name]]);
            setHistoryIndex(h => h + 1);

            cockpit.location.go("/", { path: encodeURIComponent(newPath) });
        }
    };

    const resetSelected = e => {
        if (e.target.id === "folder-view" || e.target.id === "navigator-card-body") {
            setSelected(path[path.length - 1]);
        }
    };

    const Item = ({ file }) => {
        return (
            <Card
              className={"item-button " + (file.type === "directory" ? "directory-item" : "file-item")}
              data-item={file.name}
              id={"card-item-" + file.name + file.type}
              isClickable isCompact
              isPlain isRounded
              isSelected={selected?.name === file.name}
              onClick={() => setSelected(file)}
              onContextMenu={(e) => { e.stopPropagation(); setSelectedContext(file) }}
              onDoubleClick={() => onDoubleClickNavigate(path, file)}
            >
                <CardHeader
                  selectableActions={{
                      name: file.name,
                      selectableActionAriaLabelledby: "card-item-" + file.name + file.type,
                      selectableActionId: "card-item-" + file.name + file.type + "-selectable-action",
                  }}
                >
                    <CardTitle>
                        <Flex direction={{ default: isGrid ? "column" : "row" }} spaceItems={{ default: isGrid ? "spaceItemsNone" : "spaceItemsMd" }}>
                            <FlexItem alignSelf={{ default: "alignSelfCenter" }}>
                                <Icon size={isGrid ? "xl" : "lg"} isInline>
                                    {file.type === "directory" || file.to === "directory"
                                        ? <FolderIcon />
                                        : <FileIcon />}
                                </Icon>
                            </FlexItem>
                            <FlexItem className={"pf-u-text-break-word pf-u-text-wrap" + (isGrid ? " grid-file-name" : "")}>
                                {selected?.name !== file.name ? <Truncate content={file.name} position="middle" /> : file.name}
                            </FlexItem>
                        </Flex>
                    </CardTitle>
                </CardHeader>
            </Card>
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
