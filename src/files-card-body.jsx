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

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
    Card, CardBody,
    Flex,
    Gallery,
    Icon,
    CardTitle, Spinner, CardHeader,
    MenuItem, MenuList,
    Divider,
} from "@patternfly/react-core";
import { FileIcon, FolderIcon } from "@patternfly/react-icons";

import cockpit from "cockpit";
import { useDialogs } from "dialogs.jsx";
import { ListingTable } from "cockpit-components-table.jsx";
import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";

import { ContextMenu } from "cockpit-components-context-menu.jsx";
import { fileActions, ConfirmDeletionDialog } from "./fileActions.jsx";
import { useFilesContext } from "./app";

const _ = cockpit.gettext;

const compare = (sortBy) => {
    const compareFileType = (a, b) => {
        const aIsDir = (a.type === "dir" || a?.to === "dir");
        const bIsDir = (b.type === "dir" || b?.to === "dir");

        if (aIsDir && !bIsDir)
            return -1;
        if (!aIsDir && bIsDir)
            return 1;
        return 0;
    };

    switch (sortBy) {
    case "az":
        return (a, b) => compareFileType(a, b) === 0
            ? a.name.localeCompare(b.name)
            : compareFileType(a, b);
    case "za":
        return (a, b) => compareFileType(a, b) === 0
            ? b.name.localeCompare(a.name)
            : compareFileType(a, b);
    case "last_modified":
        return (a, b) => compareFileType(a, b) === 0
            ? (a.mtime > b.mtime
                ? -1
                : 1)
            : compareFileType(a, b);
    case "first_modified":
        return (a, b) => compareFileType(a, b) === 0
            ? (a.mtime < b.mtime
                ? -1
                : 1)
            : compareFileType(a, b);
    case "size":
        return (a, b) => compareFileType(a, b) === 0
            ? (a.size > b.size
                ? -1
                : 1)
            : compareFileType(a, b) * -1;
    default:
        break;
    }
};

const ContextMenuItems = ({ path, selected, setSelected, clipboard, setClipboard }) => {
    const Dialogs = useDialogs();
    const { addAlert } = useFilesContext();
    const menuItems = fileActions(path, selected, setSelected,
                                  clipboard, setClipboard, addAlert, Dialogs);

    return (
        <MenuList>
            {menuItems.map((item, i) =>
                item.type !== "divider"
                    ? (
                        <MenuItem
                          className={"context-menu-option " + item.className} key={item.title}
                          onClick={item.onClick} isDisabled={item.isDisabled}
                        >
                            <div className="context-menu-name">{item.title}</div>
                        </MenuItem>
                    )
                    : <Divider key={i} />)}
        </MenuList>
    );
};

export const FilesCardBody = ({
    currentFilter,
    files,
    isGrid,
    path,
    selected,
    setSelected,
    sortBy,
    loadingFiles,
    clipboard,
    setClipboard,
    showHidden,
}) => {
    const [boxPerRow, setBoxPerRow] = useState(0);
    const Dialogs = useDialogs();

    const sortedFiles = useMemo(() => {
        return files
                .filter(file => showHidden ? true : !file.name.startsWith("."))
                .filter(file => file.name.toLowerCase().includes(currentFilter.toLowerCase()))
                .sort(compare(sortBy));
    }, [files, showHidden, currentFilter, sortBy]);
    const isMounted = useRef(null);
    const folderViewRef = React.useRef();

    function calculateBoxPerRow () {
        const boxes = document.querySelectorAll(".item-button");
        if (boxes.length > 1) {
            let i = 0;
            const total = boxes.length;
            const firstOffset = boxes[0].offsetTop;
            while (++i < total && boxes[i].offsetTop === firstOffset);
            setBoxPerRow(i);
        }
    }

    const onDoubleClickNavigate = useCallback((file) => {
        const newPath = [...path, file.name].join("/");
        if (file.type === "dir" || file.to === "dir") {
            cockpit.location.go("/", { path: encodeURIComponent(newPath) });
        }
    }, [path]);

    useEffect(() => {
        calculateBoxPerRow();
        window.onresize = calculateBoxPerRow;
        return () => {
            window.onresize = undefined;
        };
    });

    useEffect(() => {
        let folderViewElem = null;

        const resetSelected = e => {
            if (e.target.id === "folder-view" || e.target.id === "files-card-body") {
                if (selected.length !== 0) {
                    setSelected([]);
                }
            }
        };

        const handleDoubleClick = (ev) => {
            const name = getFilenameForEvent(ev);
            const file = sortedFiles?.find(file => file.name === name);
            if (!file)
                return null;
            if (!file) {
                resetSelected(ev);
                return;
            }

            onDoubleClickNavigate(file);
        };

        const handleClick = (ev) => {
            const name = getFilenameForEvent(ev);
            const file = sortedFiles?.find(file => file.name === name);
            if (!file) {
                resetSelected(ev);
                return;
            }

            if (ev.detail > 1) {
                onDoubleClickNavigate(file);
            } else {
                if (!ev.ctrlKey) {
                    setSelected([file]);
                } else {
                    setSelected(s => {
                        if (!s.find(f => f.name === file.name)) {
                            return [...s, file];
                        } else {
                            return s.filter(f => f.name !== file.name);
                        }
                    });
                }
            }
        };

        const handleContextMenu = (event) => {
            let sel = getFilenameForEvent(event);
            if (sel !== null && selected.length > 1) {
                return;
            }

            if (sel === null) {
                setSelected([]);
            } else {
                sel = sortedFiles?.find(file => file.name === sel);
                setSelected([sel]);
            }
        };

        const onKeyboardNav = (e) => {
            if (e.key === "ArrowRight") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0]?.name;
                    const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                    const newIdx = selectedIdx < sortedFiles.length - 1
                        ? selectedIdx + 1
                        : 0;

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "ArrowLeft") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0]?.name;
                    const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                    const newIdx = selectedIdx > 0
                        ? selectedIdx - 1
                        : sortedFiles.length - 1;

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "ArrowUp") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0]?.name;
                    const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                    const newIdx = Math.max(selectedIdx - boxPerRow, 0);

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "ArrowDown") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0]?.name;
                    const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                    const newIdx = Math.min(selectedIdx + boxPerRow, sortedFiles.length - 1);

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "Enter" && selected.length === 1) {
                onDoubleClickNavigate(selected[0]);
            } else if (e.key === "Delete" && selected.length !== 0) {
                const currentPath = path.join("/") + "/";
                Dialogs.show(
                    <ConfirmDeletionDialog
                      selected={selected} path={currentPath}
                      setSelected={setSelected}
                    />
                );
            }
        };

        if (folderViewRef.current) {
            folderViewElem = folderViewRef.current;
            folderViewElem.addEventListener("click", handleClick);
            folderViewElem.addEventListener("dblclick", handleDoubleClick);
            folderViewElem.addEventListener("contextmenu", handleContextMenu);
        }

        if (!isMounted.current && !Dialogs.isActive()) {
            isMounted.current = true;
            document.addEventListener("keydown", onKeyboardNav);
        }
        if (Dialogs.isActive())
            document.removeEventListener("keydown", onKeyboardNav);
        return () => {
            isMounted.current = false;
            document.removeEventListener("keydown", onKeyboardNav);
            if (folderViewElem) {
                folderViewElem.removeEventListener("click", handleClick);
                folderViewElem.removeEventListener("dblclick", handleDoubleClick);
                folderViewElem.removeEventListener("contextmenu", handleContextMenu);
            }
        };
    }, [
        setSelected,
        sortedFiles,
        boxPerRow,
        selected,
        onDoubleClickNavigate,
        Dialogs,
        path,
    ]);

    // Generic event handler to look up the corresponding `data-item` for a click event when
    // a user clicks in the folder view. We use three event listeners (click,
    // doubleclick and rightclick) instead of having three event listeners per
    // item in the folder view. Having a lot of event listeners hurts
    // performance, this does require us to walk up the DOM until we find the
    // required `data-item` but this is a fairly trivial at the benefit of the
    // performance gains.
    const getFilenameForEvent = event => {
        let data_item = null;
        let elem = event.target;
        // Limit iterating to ten parents
        for (let i = 0; i < 10; i++) {
            data_item = elem.getAttribute("data-item");
            if (data_item)
                break;

            if (elem.parentElement)
                elem = elem.parentElement;
            else
                break;
        }

        return data_item;
    };

    if (loadingFiles)
        return (
            <Flex justifyContent={{ default: "justifyContentCenter" }}>
                <Spinner />
            </Flex>
        );

    const files_parent_id = "files-card-parent";
    const contextMenu = (
        <ContextMenu parentId={files_parent_id}>
            <ContextMenuItems
              path={path}
              selected={selected}
              setSelected={setSelected}
              clipboard={clipboard}
              setClipboard={setClipboard}
            />
        </ContextMenu>
    );

    return (
        <div id={files_parent_id}>
            {contextMenu}
            <div
              ref={folderViewRef}
            >
                {sortedFiles.length === 0 && <EmptyStatePanel paragraph={_("Directory is empty")} />}
                {isGrid &&
                    <CardBody id="files-card-body">
                        <Gallery id="folder-view">
                            {sortedFiles.map(file =>
                                <Item
                                  file={file}
                                  key={file.name}
                                  isSelected={!!selected.find(s => s.name === file.name)}
                                  isGrid={isGrid}
                                />)}
                        </Gallery>
                    </CardBody>}
                {!isGrid &&
                    <ListingTable
                      id="folder-view"
                      className="pf-m-no-border-rows"
                      variant="compact"
                      columns={[_("Name")]}
                      rows={sortedFiles.map(file => ({
                          columns: [
                              {
                                  title: (
                                      <Item
                                        file={file}
                                        key={file.name}
                                        isSelected={!!selected.find(s => s.name === file.name)}
                                        isGrid={isGrid}
                                      />)
                              }
                          ]
                      }))}
                    />}
            </div>
        </div>
    );
};

// Memoize the Item component as rendering thousands of them on each render of parent component is costly.
const Item = React.memo(function Item({ file, isSelected, isGrid }) {
    function getFileType(file) {
        if (file.type === "dir") {
            return "directory-item";
        } else if (file.type === "lnk" && file?.to === "dir") {
            return "directory-item";
        } else {
            return "file-item";
        }
    }

    return (
        <Card
          className={"item-button " + getFileType(file)}
          data-item={file.name}
          id={"card-item-" + file.name + file.type}
          isClickable isCompact
          isPlain
          isSelected={isSelected}
        >
            <CardHeader
              selectableActions={{
                  name: file.name,
                  selectableActionAriaLabelledby: "card-item-" + file.name + file.type,
                  selectableActionId: "card-item-" + file.name + file.type + "-selectable-action",
              }}
            >
                <Icon
                  size={isGrid
                      ? "xl"
                      : "lg"} isInline
                >
                    {file.type === "dir" || file.to === "dir"
                        ? <FolderIcon />
                        : <FileIcon />}
                </Icon>
                <CardTitle>
                    {file.name}
                </CardTitle>
            </CardHeader>
        </Card>
    );
});
