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
import React, { useState } from "react";

import {
    CardHeader,
    CardTitle,
    Divider,
    Flex,
    MenuToggle,
    MenuToggleAction,
    SearchInput,
    Select,
    SelectList,
    SelectOption,
    Text,
    TextContent,
    TextVariants
} from "@patternfly/react-core";
import { SortByDirection } from '@patternfly/react-table';
import { GripVerticalIcon, ListIcon } from "@patternfly/react-icons";

import { UploadButton } from "./upload-button";

const _ = cockpit.gettext;

export const filterColumns = [
    {
        title: _("Name"),
        [SortByDirection.asc]: {
            itemId: "az",
            label: _("A-Z"),
        },
        [SortByDirection.desc]: {
            itemId: "za",
            label: _("Z-A"),
        }
    },
    {
        title: _("Size"),
        [SortByDirection.asc]: {
            itemId: "largest_size",
            label: _("Largest size"),
        },
        [SortByDirection.desc]: {
            itemId: "smallest_size",
            label: _("Smallest size"),
        }
    },
    {
        title: _("Modified"),
        [SortByDirection.asc]: {
            itemId: "first_modified",
            label: _("First modified"),
        },
        [SortByDirection.desc]: {
            itemId: "last_modified",
            label: _("Last modified"),
        },
    },
];

// { itemId: [index, sortdirection] }
export const filterColumnMapping = filterColumns.reduce((a, v, i) => ({
    ...a,
    [v[SortByDirection.asc].itemId]: [i, SortByDirection.asc],
    [v[SortByDirection.desc].itemId]: [i, SortByDirection.desc]
}), {});

export const FilesCardHeader = ({
    currentFilter,
    onFilterChange,
    isGrid,
    setIsGrid,
    sortBy,
    setSortBy,
    path
}: {
    currentFilter: string,
    onFilterChange: (_event: React.FormEvent<HTMLInputElement>, value: string) => void,
    isGrid: boolean, setIsGrid: React.Dispatch<React.SetStateAction<boolean>>,
    sortBy: string, setSortBy: React.Dispatch<React.SetStateAction<string>>
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
                />
                <Divider orientation={{ default: "vertical" }} />
                <UploadButton
                  path={path}
                />
            </Flex>
        </CardHeader>
    );
};

const ViewSelector = ({ isGrid, setIsGrid, sortBy, setSortBy }:
    { isGrid: boolean, setIsGrid: React.Dispatch<React.SetStateAction<boolean>>,
      sortBy: string, setSortBy: React.Dispatch<React.SetStateAction<string>>}) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const onToggleClick = (isOpen: boolean) => setIsOpen(!isOpen);
    const onSelect = (_ev?: React.MouseEvent, itemId?: string | number) => {
        cockpit.assert(typeof itemId === "string", "itemId is not a string");
        setIsOpen(false);
        setSortBy(itemId);
        localStorage.setItem("files:sort", itemId);
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
                {filterColumns.map((column, rowIndex) =>
                    <React.Fragment key={rowIndex}>
                        <SelectOption itemId={column[SortByDirection.asc].itemId}>
                            {column[SortByDirection.asc].label}
                        </SelectOption>
                        <SelectOption itemId={column[SortByDirection.desc].itemId}>
                            {column[SortByDirection.desc].label}
                        </SelectOption>
                    </React.Fragment>)}
            </SelectList>
        </Select>
    );
};
