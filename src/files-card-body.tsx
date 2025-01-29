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
import { Text, TextContent, TextVariants } from "@patternfly/react-core/dist/esm/components/Text";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { FolderIcon, SearchIcon } from '@patternfly/react-icons';
import { SortByDirection, Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';

import cockpit from "cockpit";
import { ContextMenu } from "cockpit-components-context-menu";
import { EmptyStatePanel } from "cockpit-components-empty-state";
import { dirname } from "cockpit-path.ts";
import { useDialogs } from "dialogs";
import * as timeformat from "timeformat";

import { get_permissions, permissionShortStr, useFilesContext } from "./common.ts";
import type { FolderFileInfo } from "./common.ts";
import { confirm_delete } from "./dialogs/delete.tsx";
import { show_create_directory_dialog } from "./dialogs/mkdir.tsx";
import { show_rename_dialog } from "./dialogs/rename.tsx";
import { Sort, filterColumnMapping, filterColumns } from "./header.tsx";
import { get_menu_items, pasteFromClipboard } from "./menu.tsx";
import "./files-card-body.scss";

const _ = cockpit.gettext;

function compare(sortBy: Sort): (a: FolderFileInfo, b: FolderFileInfo) => number {
    const dir_sort = (a: FolderFileInfo, b: FolderFileInfo) => Number(b.to === "dir") - Number(a.to === "dir");
    const name_sort = (a: FolderFileInfo, b: FolderFileInfo) => a.name.localeCompare(b.name);
    const owner_sort = (a: string | number | undefined, b: string | number | undefined) => {
        if (a === undefined || b === undefined) {
            return 0;
        }
        if (typeof a === "string" && typeof b === "string") {
            return a.localeCompare(b);
        } else if (typeof a === "string" && typeof b === "number") {
            // Sort numbers after known names
            return -1;
        } else if (typeof a === "number" && typeof b === "string") {
            // Sort numbers after known names
            return 1;
        } else if (typeof a === "number" && typeof b === "number") {
            return a - b;
        }
    };

    // treat non-regular files and infos with missing 'size' field as having size of zero
    const size = (a: FolderFileInfo) => (a.type === "reg" && a.size) || 0;
    const mtime = (a: FolderFileInfo) => a.mtime || 0; // fallbak for missing .mtime field
    // mask special bits when sorting
    const perms = (a: FolderFileInfo) => a.mode ? (a.mode & (~(0b111 << 9))) : 0;

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
    case Sort.most_permissive:
        return (a, b) => dir_sort(a, b) || (perms(b) - perms(a)) || name_sort(a, b);
    case Sort.least_permissive:
        return (a, b) => dir_sort(a, b) || (perms(a) - perms(b)) || name_sort(a, b);
    case Sort.owner_asc:
        return (a, b) => dir_sort(a, b) || owner_sort(a.user, b.user) ||
                owner_sort(a.group, b.group) || name_sort(a, b);
    case Sort.owner_desc:
        return (a, b) => dir_sort(a, b) || owner_sort(b.user, a.user) ||
                owner_sort(b.group, a.group) || name_sort(b, a);
    }
}

const ContextMenuItems = ({ path, selected, setSelected, clipboard, setClipboard } : {
    path: string,
    selected: FolderFileInfo[], setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>,
    clipboard: string[], setClipboard: React.Dispatch<React.SetStateAction<string[]>>,
}) => {
    const dialogs = useDialogs();
    const { addAlert, cwdInfo } = useFilesContext();
    const menuItems = get_menu_items(
        path, selected, setSelected, clipboard, setClipboard, cwdInfo, addAlert, dialogs
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
    setCurrentFilter,
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
    setShowHidden,
} : {
    currentFilter: string,
    setCurrentFilter: React.Dispatch<React.SetStateAction<string>>,
    files: FolderFileInfo[],
    isGrid: boolean,
    path: string,
    selected: FolderFileInfo[], setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>,
    sortBy: Sort, setSortBy: React.Dispatch<React.SetStateAction<Sort>>,
    loadingFiles: boolean,
    clipboard: string[], setClipboard: React.Dispatch<React.SetStateAction<string[]>>,
    showHidden: boolean,
    setShowHidden: React.Dispatch<React.SetStateAction<boolean>>,
}) => {
    const [boxPerRow, setBoxPerRow] = useState(0);
    const dialogs = useDialogs();
    const { addAlert, cwdInfo } = useFilesContext();

    const sortedFiles = useMemo(() => {
        return files
                .filter(file => showHidden ? true : !file.name.startsWith("."))
                .filter(file => file.name.toLowerCase().includes(currentFilter.toLowerCase()))
                .sort(compare(sortBy));
    }, [files, showHidden, currentFilter, sortBy]);
    const hiddenFilesCount = useMemo(() => {
        return files.filter(file => file.name.startsWith(".")).length;
    }, [files]);
    const isMounted = useRef<boolean>();
    const folderViewRef = useRef<HTMLDivElement>(null);

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
        const newPath = path + file.name;
        if (file.to === "dir") {
            cockpit.location.go("/", { path: encodeURIComponent(newPath) });
        }
    }, [path]);

    const goUpOneDir = useCallback(() => {
        if (path !== "/") {
            const newPath = dirname(path);
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
        let folderViewElem: HTMLDivElement | null = null;

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

        const hasNoKeydownModifiers = (event: KeyboardEvent) => {
            return !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
        };

        const onKeyboardNav = (e: KeyboardEvent) => {
            switch (e.key) {
            case "ArrowRight":
                if (hasNoKeydownModifiers(e)) {
                    setSelected(_selected => {
                        const firstSelectedName = _selected?.[0]?.name;
                        const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                        const newIdx = selectedIdx < sortedFiles.length - 1
                            ? selectedIdx + 1
                            : 0;

                        return [sortedFiles[newIdx]];
                    });
                }
                break;

            case "ArrowLeft":
                if (hasNoKeydownModifiers(e)) {
                    setSelected(_selected => {
                        const firstSelectedName = _selected?.[0]?.name;
                        const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                        const newIdx = selectedIdx > 0
                            ? selectedIdx - 1
                            : sortedFiles.length - 1;

                        return [sortedFiles[newIdx]];
                    });
                }
                break;

            case "ArrowUp":
                if (e.altKey && !e.shiftKey && !e.ctrlKey) {
                    goUpOneDir();
                } else if (hasNoKeydownModifiers(e)) {
                    setSelected(_selected => {
                        const firstSelectedName = _selected?.[0]?.name;
                        const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                        const newIdx = Math.max(selectedIdx - boxPerRow, 0);

                        return [sortedFiles[newIdx]];
                    });
                }
                break;

            case "ArrowDown":
                if (e.altKey && !e.shiftKey && !e.ctrlKey && selected.length === 1) {
                    onDoubleClickNavigate(selected[0]);
                } else if (hasNoKeydownModifiers(e)) {
                    setSelected(_selected => {
                        const firstSelectedName = _selected?.[0]?.name;
                        const selectedIdx = sortedFiles?.findIndex(file => file.name === firstSelectedName);
                        const newIdx = Math.min(selectedIdx + boxPerRow, sortedFiles.length - 1);

                        return [sortedFiles[newIdx]];
                    });
                }
                break;

            case "Enter":
                if (hasNoKeydownModifiers(e) && selected.length === 1) {
                    onDoubleClickNavigate(selected[0]);
                }
                break;

            case "Delete":
                if (hasNoKeydownModifiers(e) && selected.length !== 0) {
                    confirm_delete(dialogs, path, selected, setSelected);
                }
                break;

            case "F2":
                if (hasNoKeydownModifiers(e) && selected.length === 1) {
                    show_rename_dialog(dialogs, path, selected[0]);
                }
                break;

            case "a":
                // Keep standard text editing behavior by excluding input fields
                if (e.ctrlKey && !e.shiftKey && !e.altKey && !(e.target instanceof HTMLInputElement)) {
                    e.preventDefault();
                    setSelected(sortedFiles);
                }
                break;

            case "c":
                // Keep standard text editing behavior by excluding input fields
                if (e.ctrlKey && !e.shiftKey && !e.altKey && !(e.target instanceof HTMLInputElement)) {
                    e.preventDefault();
                    setClipboard(selected.map(s => path + s.name));
                }
                break;

            case "v":
                // Keep standard text editing behavior by excluding input fields
                if (e.ctrlKey && !e.shiftKey && !e.altKey && !(e.target instanceof HTMLInputElement)) {
                    e.preventDefault();
                    pasteFromClipboard(clipboard, cwdInfo, path, addAlert);
                }
                break;

            case "N":
                if (!e.ctrlKey && !e.altKey) {
                    e.preventDefault();
                    show_create_directory_dialog(dialogs, path);
                }
                break;

            default:
                break;
            }
        };

        if (folderViewRef.current) {
            folderViewElem = folderViewRef.current;
            folderViewElem.addEventListener("click", handleClick);
            folderViewElem.addEventListener("dblclick", handleDoubleClick);
            folderViewElem.addEventListener("contextmenu", handleContextMenu);
        }

        if (!isMounted.current && !dialogs.isActive()) {
            isMounted.current = true;
            document.addEventListener("keydown", onKeyboardNav);
        }
        if (dialogs.isActive())
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
        dialogs,
        goUpOneDir,
        path,
        addAlert,
        cwdInfo,
        clipboard,
        setClipboard,
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
            {sortedFiles.length === 0 && currentFilter &&
                <EmptyStatePanel
                  icon={SearchIcon}
                  title={_("No matching results")}
                  action={_("Clear filter")}
                  onAction={() => setCurrentFilter("")}
                  actionVariant="link"
                />}
            {sortedFiles.length === 0 && !currentFilter &&
                <EmptyStatePanel
                  icon={FolderIcon}
                  title={_("Directory is empty")}
                  paragraph={hiddenFilesCount === 0
                      ? null
                      : cockpit.format(
                          cockpit.ngettext(
                              "$0 item is hidden", "$0 items are hidden", hiddenFilesCount
                          ), hiddenFilesCount
                      )}
                  action={hiddenFilesCount === 0 ? null : _("Show hidden items")}
                  onAction={() => setShowHidden(true)}
                  actionVariant="link"
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
                            <Th
                              sort={sortColumn(3)} className="col-owner"
                              modifier="nowrap"
                            >{_("Owner")}
                            </Th>
                            <Th
                              sort={sortColumn(4)} className="col-perms"
                              modifier="nowrap"
                            >{_("Permissions")}
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

const FilePermissions = ({ file } : {
    file: FolderFileInfo,
}) => {
    const mode = file.mode;
    if (mode === undefined) {
        return null;
    }
    const permsGroups = [_("Owner"), _("Group"), _("Others")];
    const tooltip = (
        <dl className="permissions-tooltip-text">
            {permsGroups.map((permGroup, i) => {
                return (
                    <React.Fragment key={file.name + "-" + permGroup}>
                        <dt>{permGroup + ":"}</dt>
                        <dd>{get_permissions(mode >> (6 - 3 * i)).toLowerCase()}</dd>
                    </React.Fragment>
                );
            })}
        </dl>
    );

    return (
        <Tooltip content={tooltip}>
            <Text component={TextVariants.pre}>{permissionShortStr(mode)}</Text>
        </Tooltip>
    );
};

const FileOwnership = ({ file } : { file: FolderFileInfo, }) => {
    const ownerText = (file.user === file.group)
        ? file.user
        : `${file.user}:${file.group}`;

    return (
        <TextContent>
            <Text>
                {ownerText}
            </Text>
        </TextContent>
    );
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
            <Td
              className="item-owner"
              modifier="nowrap"
            >
                <FileOwnership file={file} />
            </Td>
            <Td
              className="item-perms"
              modifier="nowrap"
            >
                <FilePermissions file={file} />
            </Td>
        </Tr>
    );
});
