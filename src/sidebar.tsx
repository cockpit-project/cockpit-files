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

import React, { useState, useEffect } from "react";

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
} from "@patternfly/react-core/dist/esm/components/Card";
import {
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
} from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { DropdownItem } from "@patternfly/react-core/dist/esm/components/Dropdown";
import {
    Text,
    TextContent,
    TextVariants,
} from "@patternfly/react-core/dist/esm/components/Text";

import cockpit from "cockpit";
import { KebabDropdown } from "cockpit-components-dropdown";
import { useDialogs } from "dialogs";
import * as timeformat from "timeformat";

import { FolderFileInfo, useFilesContext } from "./app";
import { get_permissions } from "./common";
import { edit_permissions } from "./dialogs/permissions";
import { get_menu_items } from "./menu";

const _ = cockpit.gettext;

function getDescriptionListItems(selected: FolderFileInfo) {
    return [
        {
            id: "description-list-last-modified",
            label: _("Last modified"),
            value:
                "mtime" in selected
                    ? timeformat.dateTime(selected.mtime * 1000)
                    : _("unknown"),
        },
        {
            id: "description-list-owner",
            label: _("Owner"),
            value: "user" in selected ? selected.user : _("unknown"),
        },
        {
            id: "description-list-group",
            label: _("Group"),
            value: "group" in selected ? selected.group : _("unknown"),
        },
        ...(selected.type === "reg"
            ? [
                  {
                      id: "description-list-size",
                      label: _("Size"),
                      value:
                          cockpit.format_bytes(selected.size) || _("unknown"),
                  },
              ]
            : []),
        ...("mode" in selected
            ? [
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
              ]
            : []),
    ];
}

export const SidebarPanelDetails = ({
    files,
    path,
    selected,
    setSelected,
    showHidden,
    clipboard,
    setClipboard,
}: {
    files: FolderFileInfo[];
    path: string[];
    selected: FolderFileInfo[];
    setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>;
    showHidden: boolean;
    clipboard: string[];
    setClipboard: React.Dispatch<React.SetStateAction<string[]>>;
}) => {
    const [info, setInfo] = useState<string | null>(null);
    const { addAlert, cwdInfo } = useFilesContext();

    useEffect(() => {
        if (selected.length === 1) {
            const filePath = path.join("/") + "/" + selected[0]?.name;

            cockpit
                .spawn(["file", "--brief", filePath], {
                    superuser: "try",
                    err: "message",
                })
                .then((res) => setInfo(res?.trim()))
                .catch((error) =>
                    console.warn(
                        `Failed to run file --brief on ${filePath}: ${error.toString()}`,
                    ),
                );
        }
    }, [path, selected]);

    const dialogs = useDialogs();
    const directory_name = path[path.length - 1];
    const hidden_count = files.filter((file) =>
        file.name.startsWith("."),
    ).length;
    let shown_items = cockpit.format(
        cockpit.ngettext("$0 item", "$0 items", files.length),
        files.length,
    );
    if (!showHidden)
        shown_items +=
            " " +
            cockpit.format(
                cockpit.ngettext("($0 hidden)", "($0 hidden)", hidden_count),
                hidden_count,
            );

    const menuItems = get_menu_items(
        path,
        selected,
        setSelected,
        clipboard,
        setClipboard,
        cwdInfo,
        addAlert,
        dialogs,
    ).map((option, i) => {
        if (option.type === "divider") return <Divider key={i} />;
        return (
            <DropdownItem
                id={option.id}
                key={option.id}
                {...(option.className && { className: option.className })}
                onClick={option.onClick}
                isDisabled={option.isDisabled || false}
            >
                {option.title}
            </DropdownItem>
        );
    });

    return (
        <Card className="sidebar-card">
            <CardHeader>
                <CardTitle component="h2" id="sidebar-card-header">
                    <TextContent>
                        <Text component={TextVariants.h2}>
                            {selected.length === 1
                                ? selected[0].name
                                : directory_name}
                        </Text>
                        {selected.length === 0 && (
                            <Text component={TextVariants.small}>
                                {shown_items}
                            </Text>
                        )}
                        {selected.length > 1 && (
                            <Text component={TextVariants.small}>
                                {cockpit.format(
                                    "$0 items selected",
                                    selected.length,
                                )}
                            </Text>
                        )}
                        {selected.length === 1 && (
                            <Text component={TextVariants.small}>{info}</Text>
                        )}
                    </TextContent>
                </CardTitle>
                <KebabDropdown
                    toggleButtonId="dropdown-menu"
                    dropdownItems={menuItems}
                    isDisabled={cwdInfo === null}
                />
            </CardHeader>
            {selected.length === 1 && (
                <CardBody>
                    <DescriptionList
                        id="description-list-sidebar"
                        className="sidebar-details"
                    >
                        {getDescriptionListItems(selected[0]).map((item) => (
                            <DescriptionListGroup key={item.id} id={item.id}>
                                <DescriptionListTerm>
                                    {item.label}
                                </DescriptionListTerm>
                                <DescriptionListDescription>
                                    {item.value}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        ))}
                    </DescriptionList>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            edit_permissions(dialogs, selected[0], path);
                        }}
                    >
                        {_("Edit permissions")}
                    </Button>
                </CardBody>
            )}
        </Card>
    );
};
