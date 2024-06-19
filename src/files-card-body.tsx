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

import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { MenuItem, MenuList } from "@patternfly/react-core/dist/esm/components/Menu";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { SortByDirection, Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';

import cockpit from "cockpit";
import { ContextMenu } from "cockpit-components-context-menu";
import { EmptyStatePanel } from "cockpit-components-empty-state";
import { useDialogs } from "dialogs";
import * as timeformat from "timeformat";

import { FolderFileInfo, useFilesContext } from "./app";
import { ConfirmDeletionDialog } from "./fileActions";
import { Sort, filterColumnMapping, filterColumns } from "./header";
import { get_menu_items } from "./menu";

import "./files-card-body.scss";

const _ = cockpit.gettext;

function compare(sortBy: Sort): (a: FolderFileInfo, b: FolderFileInfo) => number {
    const dir_sort = (a: FolderFileInfo, b: FolderFileInfo) => Number(b.to === "dir") - Number(a.to === "dir");
    const name_sort = (a: FolderFileInfo, b: FolderFileInfo) => a.name.localeCompare(b.name);

    // treat non-regular files and infos with missing 'size' field as having size of zero
    const size = (a: FolderFileInfo) => (a.type === "reg" && a.size) || 0;
    const mtime = (a: FolderFileInfo) => a.mtime || 0; // fallbak for missing .mtime field

    switch (sortBy) {
    case Sort.az:
        return (a, b) => dir_sort(a, b) || name_sort(a, b);
    case Sort.za:
        return (a, b) => dir_sort(a, b) || name_sort(b, a);
    case Sort.first_modified:
        return (a, b) => dir_sort(a, b) || (mtime(a) - mtime(b)) || name_sort(a, b);
    case Sort.last_modified:
        return (a, b) => dir_sort(a, b) || (mtime(b) - mtime(a)) || name_sort(a, b);
    case Sort.largest_size:
        return (a, b) => dir_sort(a, b) || (size(b) - size(a)) || name_sort(a, b);
    case Sort.smallest_size:
        return (a, b) => dir_sort(a, b) || (size(a) - size(b)) || name_sort(a, b);
    }
}

const ContextMenuItems = ({ path, selected, setSelected, clipboard, setClipboard } : {
    path: string[],
    selected: FolderFileInfo[], setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>,
    clipboard: string[], setClipboard: React.Dispatch<React.SetStateAction<string[]>>,
}) => {
    const Dialogs = useDialogs();
    const { addAlert, cwdInfo } = useFilesContext();
    const menuItems = get_menu_items(
        path, selected, setSelected, clipboard, setClipboard, cwdInfo, addAlert, Dialogs
    );

    return (
        <MenuList>
            {menuItems.map((item, i) =>
                item.type !== 'divider'
                    ? (
                        <MenuItem
                          key={item.id}
                          className={"context-menu-option " + (item.className || '')}
                          isDisabled={item.isDisabled || false}
                          onClick={item.onClick}
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
    setSortBy,
    loadingFiles,
    clipboard,
    setClipboard,
    showHidden,
} : {
    currentFilter: string,
    files: FolderFileInfo[],
    isGrid: boolean,
    path: string[],
    selected: FolderFileInfo[], setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>,
    sortBy: Sort, setSortBy: React.Dispatch<React.SetStateAction<Sort>>,
    loadingFiles: boolean,
    clipboard: string[], setClipboard: React.Dispatch<React.SetStateAction<string[]>>,
    showHidden: boolean,
}) => {
    const [boxPerRow, setBoxPerRow] = useState(0);
    const Dialogs = useDialogs();

    const sortedFiles = useMemo(() => {
        return files
                .filter(file => showHidden ? true : !file.name.startsWith("."))
                .filter(file => file.name.toLowerCase().includes(currentFilter.toLowerCase()))
                .sort(compare(sortBy));
    }, [files, showHidden, currentFilter, sortBy]);
    const isMounted = useRef<boolean>();
    const folderViewRef = React.useRef<HTMLDivElement>(null);

    function calculateBoxPerRow () {
        const boxes = document.querySelectorAll(".fileview tbody > tr") as NodeListOf<HTMLElement>;
        if (boxes.length > 1) {
            let i = 0;
            const total = boxes.length;
            const firstOffset = boxes[0].offsetTop;
            while (++i < total && boxes[i].offsetTop === firstOffset);
            setBoxPerRow(i);
        }
    }

    const onDoubleClickNavigate = useCallback((file: FolderFileInfo) => {
        const newPath = [...path, file.name].join("/");
        if (file.to === "dir") {
            cockpit.location.go("/", { path: encodeURIComponent(newPath) });
        }
    }, [path]);

    useEffect(() => {
        calculateBoxPerRow();
        window.onresize = calculateBoxPerRow;
        return () => {
            window.onresize = null;
        };
    });

    useEffect(() => {
        let folderViewElem = null;

        const resetSelected = (e: MouseEvent) => {
            if ((e.target instanceof HTMLElement)) {
                if (e.target.id === "folder-view" || e.target.id === "files-card-parent" ||
                  (e.target.parentElement && e.target.parentElement.id === "folder-view")) {
                    if (selected.length !== 0) {
                        setSelected([]);
                    }
                }
            }
        };

        const handleDoubleClick = (ev: MouseEvent) => {
            ev.preventDefault();
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

        const handleClick = (ev: MouseEvent) => {
            ev.preventDefault();
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

        const handleContextMenu = (event: MouseEvent) => {
            const name = getFilenameForEvent(event);
            if (name !== null && selected.length > 1) {
                return;
            }

            const sel = sortedFiles?.find(file => file.name === name);
            if (sel) {
                setSelected([sel]);
            } else {
                setSelected([]);
            }
        };

        const onKeyboardNav = (e: KeyboardEvent) => {
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
    const getFilenameForEvent = (event: Event) => {
        let data_item = null;
        let elem = event.target as HTMLElement;
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

    const sortColumn = (columnIndex: number) => ({
        sortBy: {
            index: filterColumnMapping[sortBy][0],
            direction: filterColumnMapping[sortBy][1],
        },
        onSort: (_event: unknown, index: number, direction: SortByDirection) => {
            setSortBy(filterColumns[index][direction].itemId);
        },
        columnIndex,
    });

    return (
        <div
          id={files_parent_id}
          className="fileview-wrapper"
          ref={folderViewRef}
        >
            {contextMenu}
            {sortedFiles.length === 0 &&
                <EmptyStatePanel
                  paragraph={currentFilter ? _("No matching results") : _("Directory is empty")}
                />}
            {sortedFiles.length !== 0 &&
                <Table
                  id="folder-view"
                  className={`pf-m-no-border-rows fileview ${isGrid ? 'view-grid' : 'view-details'}`}
                  variant="compact"
                >
                    <Thead>
                        <Tr>
                            <Th sort={sortColumn(0)} className="col-name">{_("Name")}</Th>
                            <Th sort={sortColumn(1)} className="col-size">{_("Size")}</Th>
                            <Th
                              sort={sortColumn(2)} className="col-date"
                              modifier="nowrap"
                            >{_("Modified")}
                            </Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {sortedFiles.map((file, rowIndex) =>
                            <Row
                              key={rowIndex}
                              file={file}
                              isSelected={selected.some(s => s.name === file.name)}
                            />)}
                    </Tbody>
                </Table>}
        </div>
    );
};

const getFileType = (file: FolderFileInfo) => {
    if (file.to === "dir") {
        return "folder";
    } else if (file.category?.class) {
        return file.category.class;
    } else {
        return "file";
    }
};

// Memoize the Item component as rendering thousands of them on each render of parent component is costly.
const Row = React.memo(function Item({ file, isSelected } : {
    file: FolderFileInfo,
    isSelected: boolean
}) {
    const fileType = getFileType(file);
    let className = fileType;
    if (isSelected)
        className += " row-selected";
    if (file.type === "lnk")
        className += " symlink";

    return (
        <Tr
          className={className}
          data-item={file.name}
        >
            <Td
              className="item-name"
              dataLabel={fileType}
            >
                <a href="#">{file.name}</a>
            </Td>
            <Td
              className="item-size pf-v5-m-tabular-nums"
              dataLabel="size"
            >
                {file.type === 'reg' && cockpit.format_bytes(file.size)}
            </Td>
            <Td
              className="item-date pf-v5-m-tabular-nums"
              dataLabel="date"
              modifier="nowrap"
            >
                {file.mtime ? timeformat.dateTime(file.mtime * 1000) : null}
            </Td>
        </Tr>
    );
});
