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

const compare = (files, sortBy) => {
    const compareFileType = (a, b) => {
        a = files[a];
        b = files[b];
        // TODO: info.target(name)?.type
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
            ? a.localeCompare(b)
            : compareFileType(a, b);
    case "za":
        return (a, b) => compareFileType(a, b) === 0
            ? b.localeCompare(a)
            : compareFileType(a, b);
    case "last_modified":
        return (a, b) => compareFileType(a, b) === 0
            ? (files[a].mtime > files[b].mtime
                ? -1
                : 1)
            : compareFileType(a, b);
    case "first_modified":
        return (a, b) => compareFileType(a, b) === 0
            ? (files[a].mtime < files[b].mtime
                ? -1
                : 1)
            : compareFileType(a, b);
    default:
        break;
    }
};

const ContextMenuItems = ({ files, path, selected, setSelected, clipboard, setClipboard }) => {
    const Dialogs = useDialogs();
    const { addAlert } = useFilesContext();
    const menuItems = fileActions(files, path, selected, setSelected,
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
        return Object.keys(files)
                .filter(filename => showHidden ? true : !filename.startsWith("."))
                .filter(filename => filename?.toLowerCase().includes(currentFilter.toLowerCase()))
                .sort(compare(files, sortBy));
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

    const onDoubleClickNavigate = useCallback((filename) => {
        const newPath = [...path, filename].join("/");
        const file = files[filename];
        if (files && (file.type === "dir" || file.to === "dir")) {
            cockpit.location.go("/", { path: encodeURIComponent(newPath) });
        }
    }, [files, path]);

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
            const file = sortedFiles?.find(filename => filename === name);
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
            const file = sortedFiles?.find(filename => filename === name);
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
                        if (!s.find(f => f === name)) {
                            return [...s, file];
                        } else {
                            return s.filter(f => f !== name);
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
                sel = sortedFiles?.find(filename => filename === sel);
                setSelected([sel]);
            }
        };

        const onKeyboardNav = (e) => {
            if (e.key === "ArrowRight") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0];
                    const selectedIdx = sortedFiles?.findIndex(filename => filename === firstSelectedName);
                    const newIdx = selectedIdx < sortedFiles.length - 1
                        ? selectedIdx + 1
                        : 0;

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "ArrowLeft") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0];
                    const selectedIdx = sortedFiles?.findIndex(filename => filename === firstSelectedName);
                    const newIdx = selectedIdx > 0
                        ? selectedIdx - 1
                        : sortedFiles.length - 1;

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "ArrowUp") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0];
                    const selectedIdx = sortedFiles?.findIndex(filename => filename === firstSelectedName);
                    const newIdx = Math.max(selectedIdx - boxPerRow, 0);

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "ArrowDown") {
                setSelected(_selected => {
                    const firstSelectedName = _selected?.[0];
                    const selectedIdx = sortedFiles?.findIndex(filename => filename === firstSelectedName);
                    const newIdx = Math.min(selectedIdx + boxPerRow, sortedFiles.length - 1);

                    return [sortedFiles[newIdx]];
                });
            } else if (e.key === "Enter" && selected.length === 1) {
                onDoubleClickNavigate(selected[0]);
            } else if (e.key === "Delete" && selected.length !== 0) {
                const currentPath = path.join("/") + "/";
                Dialogs.show(
                    <ConfirmDeletionDialog
                      path={currentPath}
                      files={files}
                      selected={selected}
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
        files,
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
              files={files}
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
                            {sortedFiles.map(filename =>
                                <Item
                                  filename={filename}
                                  file={files[filename]}
                                  key={filename}
                                  isSelected={!!selected.find(s => s === filename)}
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
                      rows={sortedFiles.map(filename => ({
                          columns: [
                              {
                                  title: (
                                      <Item
                                        filename={filename}
                                        file={files[filename]}
                                        key={filename}
                                        isSelected={!!selected.find(s => s === filename)}
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
const Item = React.memo(function Item({ file, filename, isSelected, isGrid }) {
    const { cwdInfo } = useFilesContext();
    console.log(cwdInfo);
    function getFileType(file) {
        if (file.type === "dir") {
            return "directory-item";
        // TODO: info.target(name)?.type
        } else if (file.type === "lnk" && cwdInfo?.targets[filename]?.type === "dir") {
            return "directory-item";
        } else {
            return "file-item";
        }
    }

    return (
        <Card
          className={"item-button " + getFileType(file)}
          data-item={filename}
          id={"card-item-" + filename + file.type}
          isClickable isCompact
          isPlain
          isSelected={isSelected}
        >
            <CardHeader
              selectableActions={{
                  name: filename,
                  selectableActionAriaLabelledby: "card-item-" + filename + file.type,
                  selectableActionId: "card-item-" + filename + file.type + "-selectable-action",
              }}
            >
                <Icon
                  size={isGrid
                      ? "xl"
                      : "lg"} isInline
                >
                    {getFileType(file) === "directory-item"
                        ? <FolderIcon />
                        : <FileIcon />}
                </Icon>
                <CardTitle>
                    {filename}
                </CardTitle>
            </CardHeader>
        </Card>
    );
});
