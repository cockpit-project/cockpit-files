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

import React, { useState } from "react";

import { CardHeader, CardTitle } from "@patternfly/react-core/dist/esm/components/Card";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { MenuToggle, MenuToggleAction } from "@patternfly/react-core/dist/esm/components/MenuToggle";
import { SearchInput } from "@patternfly/react-core/dist/esm/components/SearchInput";
import { Select, SelectGroup, SelectList, SelectOption } from "@patternfly/react-core/dist/esm/components/Select";
import { Text, TextContent, TextVariants } from "@patternfly/react-core/dist/esm/components/Text";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { EyeIcon, EyeSlashIcon, GripVerticalIcon, ListIcon } from "@patternfly/react-icons";
import { SortByDirection } from '@patternfly/react-table';

import cockpit from "cockpit";

import { UploadButton } from "./upload-button";

const _ = cockpit.gettext;

export enum Sort {
    az = 'az',
    za = 'za',
    largest_size = 'largest_size',
    smallest_size = 'smallest_size',
    first_modified = 'first_modified',
    last_modified = 'last_modified',
}

export function is_sort(x: unknown): x is Sort {
    return typeof x === 'string' && x in Sort;
}

export function as_sort(x: unknown): Sort {
    return is_sort(x) ? x : Sort.az;
}

export const filterColumns = [
    {
        title: _("Name"),
        [SortByDirection.asc]: {
            itemId: Sort.az,
            label: _("A-Z"),
        },
        [SortByDirection.desc]: {
            itemId: Sort.za,
            label: _("Z-A"),
        }
    },
    {
        title: _("Size"),
        [SortByDirection.asc]: {
            itemId: Sort.largest_size,
            label: _("Largest size"),
        },
        [SortByDirection.desc]: {
            itemId: Sort.smallest_size,
            label: _("Smallest size"),
        }
    },
    {
        title: _("Modified"),
        [SortByDirection.asc]: {
            itemId: Sort.first_modified,
            label: _("First modified"),
        },
        [SortByDirection.desc]: {
            itemId: Sort.last_modified,
            label: _("Last modified"),
        },
    },
] as const;

// { itemId: [index, sortdirection] }
export const filterColumnMapping = filterColumns.reduce((a, v, i) => ({
    ...a,
    [v[SortByDirection.asc].itemId]: [i, SortByDirection.asc],
    [v[SortByDirection.desc].itemId]: [i, SortByDirection.desc]
}), {}) as Record<Sort, [number, SortByDirection]>;

export const FilesCardHeader = ({
    currentFilter,
    onFilterChange,
    isGrid,
    setIsGrid,
    sortBy,
    setSortBy,
    showHidden,
    setShowHidden,
    path,
}: {
    currentFilter: string,
    onFilterChange: (_event: React.FormEvent<HTMLInputElement>, value: string) => void,
    isGrid: boolean, setIsGrid: React.Dispatch<React.SetStateAction<boolean>>,
    sortBy: Sort, setSortBy: React.Dispatch<React.SetStateAction<Sort>>
    showHidden: boolean, setShowHidden: React.Dispatch<React.SetStateAction<boolean>>,
    path: string[],
}) => {
    return (
        <CardHeader className="card-actionbar">
            <CardTitle component="h2" id="files-card-header">
                <TextContent>
                    <Text component={TextVariants.h2}>
                        {_("Directories & files")}
                    </Text>
                </TextContent>
            </CardTitle>
            <Flex flexWrap={{ default: "nowrap" }} alignItems={{ default: "alignItemsCenter" }}>
                <SearchInput
                  placeholder={_("Filter directory")} value={currentFilter}
                  onChange={onFilterChange}
                  onClear={event => onFilterChange(event as React.FormEvent<HTMLInputElement>, "")}
                />
                <ViewSelector
                  isGrid={isGrid} setIsGrid={setIsGrid}
                  setSortBy={setSortBy} sortBy={sortBy}
                  showHidden={showHidden} setShowHidden={setShowHidden}
                />
                <Divider orientation={{ default: "vertical" }} />
                <UploadButton
                  path={path}
                />
            </Flex>
        </CardHeader>
    );
};

const ViewSelector = ({ isGrid, setIsGrid, sortBy, setSortBy, showHidden, setShowHidden }:
    { isGrid: boolean, setIsGrid: React.Dispatch<React.SetStateAction<boolean>>,
      sortBy: Sort, setSortBy: React.Dispatch<React.SetStateAction<Sort>>
      showHidden: boolean, setShowHidden: React.Dispatch<React.SetStateAction<boolean>>,
    }) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const onToggleClick = (isOpen: boolean) => setIsOpen(!isOpen);
    const onSelect = (_ev?: React.MouseEvent, itemId?: string | number) => {
        if (itemId === "hidden-toggle") {
            setShowHidden(prevShowHidden => {
                localStorage.setItem("files:showHiddenFiles", !showHidden ? "true" : "false");
                return !prevShowHidden;
            });
        } else {
            const sort = as_sort(itemId);
            setSortBy(sort);
            localStorage.setItem("files:sort", sort);
        }
        setIsOpen(false);
    };

    return (
        <Select
          id="sort-menu"
          isOpen={isOpen}
          selected={sortBy}
          onSelect={onSelect}
          onOpenChange={setIsOpen}
          popperProps={{ position: "right" }}
          toggle={toggleRef => (
              <MenuToggle
                id="sort-menu-toggle"
                className="view-toggle-group"
                isExpanded={isOpen}
                onClick={() => onToggleClick(isOpen)}
                ref={toggleRef}
                splitButtonOptions={{
                    variant: "action",
                    items: [
                        <MenuToggleAction
                          aria-label={isGrid
                              ? _("Display as a list")
                              : _("Display as a grid")}
                          key="view-toggle-action"
                          onClick={() => setIsGrid(isGrid => {
                              localStorage.setItem("files:isGrid", !isGrid ? "true" : "false");
                              return !isGrid;
                          })}
                        >
                            {isGrid
                                ? <ListIcon className="view-toggle-icon" />
                                : <GripVerticalIcon className="view-toggle-icon" />}
                        </MenuToggleAction>
                    ]
                }}
                variant="secondary"
              />
          )}
        >
            <SelectList>
                <SelectGroup key="sort-selectgroup" label={_("Sort")}>
                    {filterColumns.map((column, rowIndex) =>
                        <React.Fragment key={rowIndex}>
                            <SelectOption itemId={column[SortByDirection.asc].itemId}>
                                {column[SortByDirection.asc].label}
                            </SelectOption>
                            <SelectOption itemId={column[SortByDirection.desc].itemId}>
                                {column[SortByDirection.desc].label}
                            </SelectOption>
                        </React.Fragment>)}
                </SelectGroup>
                <Divider />
                <SelectOption icon={showHidden ? <EyeSlashIcon /> : <EyeIcon />} itemId="hidden-toggle">
                    {showHidden ? _("Hide hidden items") : _("Show hidden items")}
                </SelectOption>
            </SelectList>
        </Select>
    );
};
