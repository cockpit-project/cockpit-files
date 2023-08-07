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
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    Dropdown,
    DropdownItem,
    DropdownList,
    Flex,
    FlexItem,
    Icon,
    MenuToggle,
    Text,
    TextContent,
    TextVariants,
} from "@patternfly/react-core";

import {
    CheckIcon,
    EllipsisVIcon,
} from "@patternfly/react-icons";

import * as timeformat from "timeformat";
import { useDialogs } from "dialogs.jsx";

import { createDirectory, createLink, deleteItem, renameItem } from "./fileActions.jsx";

const _ = cockpit.gettext;

export const SidebarPanelDetails = ({ selected, path, setPath, showHidden, setShowHidden, setHistory, setHistoryIndex, files }) => {
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
                <DropdownWithKebab
                  selected={selected} path={path}
                  setPath={setPath} showHidden={showHidden}
                  setShowHidden={setShowHidden} setHistory={setHistory}
                  setHistoryIndex={setHistoryIndex} files={files}
                />
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

const DropdownWithKebab = ({ selected, path, setPath, showHidden, setShowHidden, setHistory, setHistoryIndex, files }) => {
    const Dialogs = useDialogs();
    const [isOpen, setIsOpen] = useState(false);

    const onToggleClick = () => {
        setIsOpen(!isOpen);
    };
    const onSelect = (_event, itemId) => {
        setIsOpen(false);
    };
    const onToggleHidden = () => {
        setShowHidden(!showHidden);
    };

    const currentDirectory = "/" + path.join("/") + "/";

    return (
        <Dropdown
          isPlain
          isOpen={isOpen}
          onSelect={onSelect}
          onOpenChange={setIsOpen}
          popperProps={{ position: "right" }}
          toggle={toggleRef =>
              <MenuToggle
                ref={toggleRef} variant="plain"
                onClick={onToggleClick} isExpanded={isOpen}
                id="dropdown-menu"
              >
                  <EllipsisVIcon />
              </MenuToggle>}
        >
            <DropdownList>
                {selected.type !== "file" &&
                <>
                    <DropdownItem
                      id="show-hidden-items" key="show-hidden-items"
                      onClick={onToggleHidden}
                    >
                        <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                            <FlexItem>{_("Show hidden items")}</FlexItem>
                            <FlexItem>{showHidden && <Icon size="sm"><CheckIcon className="check-icon" /></Icon>}</FlexItem>
                        </Flex>
                    </DropdownItem>
                    <DropdownItem
                      id="create-item" key="create-item"
                      onClick={() => { createDirectory(Dialogs, currentDirectory, selected) }}
                    >
                        {_("Create directory")}
                    </DropdownItem>
                </>}
                <DropdownItem
                  id="create-link" key="create-link"
                  onClick={() => { createLink(Dialogs, currentDirectory, files) }}
                >
                    {_("Create link")}
                </DropdownItem>
                <DropdownItem
                  id="rename-item" key="rename-item"
                  onClick={() => { renameItem(Dialogs, { selected, path, setPath }) }}
                >
                    {selected.type === "file" ? _("Rename file") : _("Rename directory")}
                </DropdownItem>
                <DropdownItem
                  id="copy-path" key="copy-path"
                  onClick={() => { navigator.clipboard.writeText("/" + path.join("/") + "/" + selected.name) }}
                >
                    {_("Copy full path")}
                </DropdownItem>
                <DropdownItem
                  id="delete-item" key="delete-item"
                  onClick={() => { deleteItem(Dialogs, { selected, itemPath: currentDirectory + (selected.items_cnt ? "" : selected.name), path, setPath, setHistory, setHistoryIndex }) }} className="pf-m-danger"
                >
                    {selected.type === "file" ? _("Delete file") : _("Delete directory")}
                </DropdownItem>
            </DropdownList>
        </Dropdown>
    );
};
