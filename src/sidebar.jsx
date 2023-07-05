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
    MenuToggle,
    Text,
    TextContent,
    TextVariants,
} from "@patternfly/react-core";

import {
    EllipsisVIcon,
} from "@patternfly/react-icons";

import * as timeformat from "timeformat";
import { useDialogs } from "dialogs.jsx";

import { createDirectory, deleteItem, renameItem } from "./fileActions.jsx";

const _ = cockpit.gettext;

export const SidebarPanelDetails = ({ selected, path, setPath, setPathIndex }) => {
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
                <DropdownItem id="rename-item" key="rename-item" onClick={() => { renameItem(Dialogs, { selected, path, setPath }) }}>
                    {selected.type === "file" ? _("Rename file") : _("Rename directory")}
                </DropdownItem>
                <DropdownItem id="delete-item" key="delete-item" onClick={() => { deleteItem(Dialogs, { selected, itemPath: "/" + path.join("/") + "/" + (selected.items_cnt ? "" : selected.name), path, setPath, setPathIndex }) }} className="pf-m-danger">
                    {selected.type === "file" ? _("Delete file") : _("Delete directory")}
                </DropdownItem>
            </DropdownList>
        </Dropdown>
    );
};
