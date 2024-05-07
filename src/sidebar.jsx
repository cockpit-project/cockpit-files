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

import React, { useState, useEffect } from "react";

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    Divider,
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

import { editPermissions, fileActions } from "./fileActions.jsx";
import { get_permissions } from "./common";
import { useFilesContext } from "./app";

const _ = cockpit.gettext;

const getDescriptionListItems = selected => {
    return ([
        {
            id: "description-list-last-modified",
            label: _("Last modified"),
            value: timeformat.dateTime(selected.mtime * 1000)
        },
        {
            id: "description-list-owner",
            label: _("Owner"),
            value: selected.user
        },
        {
            id: "description-list-group",
            label: _("Group"),
            value: selected.group
        },
        ...(selected.type === "reg"
            ? [
                {
                    id: "description-list-size",
                    label: _("Size"),
                    value: cockpit.format_bytes(selected.size),
                },
            ]
            : []),
        {
            id: "description-list-owner-permissions",
            label: _("Owner permissions"),
            value: get_permissions(selected.mode >> 6),
        },
        {
            id: "description-list-group-permissions",
            label: _("Group permissions"),
            value: get_permissions(selected.mode >> 3),
        },
        {
            id: "description-list-other-permissions",
            label: _("Other permissions"),
            value: get_permissions(selected.mode >> 0),
        },
    ]);
};

export const SidebarPanelDetails = ({
    files,
    path,
    selected,
    showHidden,
    setSelected,
    clipboard,
    setClipboard,
}) => {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        if (selected.length === 1) {
            const filePath = path.join("/") + "/" + selected[0];

            cockpit.spawn(["file", "--brief", filePath], { superuser: "try", error: "message" })
                    .then(res => setInfo(res?.trim()))
                    .catch(error => console.warn(`Failed to run file --brief on ${filePath}: ${error.toString()}`));
        }
    }, [path, selected]);

    const Dialogs = useDialogs();
    const directory_name = path[path.length - 1];
    const filenames = Object.keys(files);
    const hidden_count = filenames.filter(filename => filename.startsWith(".")).length;
    let shown_items = cockpit.format(cockpit.ngettext("$0 item", "$0 items", filenames.length), filenames.length);
    if (!showHidden)
        shown_items += " " + cockpit.format(cockpit.ngettext("($0 hidden)", "($0 hidden)", hidden_count), hidden_count);

    return (
        <Card className="sidebar-card">
            <CardHeader>
                <CardTitle component="h2" id="sidebar-card-header">
                    <TextContent>
                        <Text component={TextVariants.h2}>{selected.length === 1
                            ? selected[0]
                            : directory_name}
                        </Text>
                        {selected.length === 0 &&
                            <Text component={TextVariants.small}>
                                {shown_items}
                            </Text>}
                        {selected.length > 1 &&
                            <Text component={TextVariants.small}>
                                {cockpit.format("$0 items selected", selected.length)}
                            </Text>}
                        {selected.length === 1 &&
                            <Text component={TextVariants.small}>
                                {info}
                            </Text>}
                    </TextContent>
                </CardTitle>
                <DropdownWithKebab
                  files={files}
                  selected={selected} path={path}
                  clipboard={clipboard} setClipboard={setClipboard}
                  setSelected={setSelected}
                />
            </CardHeader>
            {selected.length === 1 && files[selected[0]] &&
            <CardBody>
                <DescriptionList isHorizontal id="description-list-sidebar">
                    {getDescriptionListItems(files[selected[0]]).map((item, index) => (
                        <DescriptionListGroup key={item.id} id={item.id}>
                            <DescriptionListTerm>{item.label}</DescriptionListTerm>
                            <DescriptionListDescription>
                                {item.value}
                            </DescriptionListDescription>
                        </DescriptionListGroup>))}
                </DescriptionList>
                <Button
                  variant="secondary"
                  onClick={() => {
                      editPermissions(Dialogs, files, selected, path);
                  }}
                >
                    {_("Edit permissions")}
                </Button>
            </CardBody>}
        </Card>
    );
};

const DropdownWithKebab = ({
    files,
    selected,
    path,
    clipboard,
    setClipboard,
    setSelected,
}) => {
    const Dialogs = useDialogs();
    const [isOpen, setIsOpen] = useState(false);
    const { addAlert } = useFilesContext();

    const onToggleClick = () => setIsOpen(!isOpen);
    const onSelect = (_event, itemId) => setIsOpen(false);
    const menuItems = fileActions(files, path, selected, setSelected,
                                  clipboard, setClipboard, addAlert, Dialogs);

    return (
        <Dropdown
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
                {menuItems.map((option, i) => {
                    if (option.type === "divider")
                        return <Divider key={i} />;
                    return (
                        <DropdownItem
                          id={option.id} key={option.id}
                          className={option.className} onClick={option.onClick}
                          isDisabled={option.isDisabled}
                        >
                            {option.title}
                        </DropdownItem>
                    );
                })}
            </DropdownList>
        </Dropdown>
    );
};
