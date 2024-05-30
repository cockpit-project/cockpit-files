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
import React from "react";
import { CheckIcon, HddIcon, PencilAltIcon, TimesIcon } from "@patternfly/react-icons";

import { Button, Flex, FlexItem, PageBreadcrumb, TextInput } from "@patternfly/react-core";

import { SettingsDropdown } from "./settings-dropdown.jsx";

function useHostname() {
    const [hostname, setHostname] = React.useState<string | null>(null);

    React.useEffect(() => {
        const client = cockpit.dbus('org.freedesktop.hostname1');
        const hostname1 = client.proxy('org.freedesktop.hostname1', '/org/freedesktop/hostname1');

        function changed() {
            if (hostname1.valid && typeof hostname1.Hostname === 'string') {
                setHostname(hostname1.Hostname);
            }
        }

        hostname1.addEventListener("changed", changed);
        return () => {
            hostname1.removeEventListener("changed", changed);
            client.close();
        };
    }, []);

    return hostname;
}

// eslint-disable-next-line max-len
export function FilesBreadcrumbs({ path, showHidden, setShowHidden }: { path: string[], showHidden: boolean, setShowHidden: React.Dispatch<React.SetStateAction<boolean>>}) {
    const [editMode, setEditMode] = React.useState(false);
    const [newPath, setNewPath] = React.useState<string | null>(null);
    const hostname = useHostname();

    function navigate(n_parts: number) {
        cockpit.location.go("/", { path: encodeURIComponent(path.slice(0, n_parts).join("/")) });
    }

    const handleInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
        // Don't propogate navigation specific events
        if (event.key === "ArrowDown" || event.key === "ArrowUp" ||
            event.key === "ArrowLeft" || event.key === "ArrowRight" ||
            event.key === "Delete") {
            event.stopPropagation();
        }
        if (event.key === "Enter") {
            event.stopPropagation();
            changePath();
        } else if (event.key === "Escape") {
            cancelPathEdit();
        }
    };

    const enableEditMode = () => {
        setEditMode(true);
        setNewPath(path.join("/") || "/");
    };

    const changePath = () => {
        setEditMode(false);
        cockpit.assert(newPath !== null, "newPath cannot be null");
        // HACK: strip trailing / to circumvent the path being `//` in breadcrumbs
        cockpit.location.go("/", { path: encodeURIComponent(newPath.replace(/\/$/, '')) });
        setNewPath(null);
    };

    const cancelPathEdit = () => {
        setNewPath(null);
        setEditMode(false);
    };

    const fullPath = path.slice(1);
    fullPath.unshift(hostname || "server");

    return (
        <PageBreadcrumb stickyOnBreakpoint={{ default: "top" }}>
            <Flex spaceItems={{ default: "spaceItemsXs" }}>
                {!editMode &&
                    <Button
                      variant="secondary"
                      icon={<PencilAltIcon />}
                      onClick={() => enableEditMode()}
                      className="breadcrumb-edit-button"
                    />}
                {!editMode && fullPath.map((dir, i) => {
                    return (
                        <React.Fragment key={fullPath.slice(0, i).join("/") || "/"}>
                            <Button
                              isDisabled={i === path.length - 1}
                              icon={i === 0 ? <HddIcon /> : null}
                              variant="link" onClick={() => { navigate(i + 1) }}
                              className="breadcrumb-button"
                            >
                                {dir || "/"}
                            </Button>
                            {dir !== "" && <p key={i}>/</p>}
                        </React.Fragment>
                    );
                })}
                {editMode && newPath !== null &&
                    <FlexItem flex={{ default: "flex_1" }}>
                        <TextInput
                          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                          id="new-path-input"
                          value={newPath}
                          onFocus={(event) => event.target.select()}
                          onKeyDown={handleInputKey}
                          onChange={(_event, value) => setNewPath(value)}
                        />
                    </FlexItem>}
                <FlexItem align={{ default: 'alignRight' }}>
                    {editMode &&
                    <>
                        <Button
                          variant="plain"
                          icon={<CheckIcon className="breadcrumb-edit-apply-icon" />}
                          onClick={changePath}
                          className="breadcrumb-edit-apply-button"
                        />
                        <Button
                          variant="plain"
                          icon={<TimesIcon />}
                          onClick={() => cancelPathEdit()}
                          className="breadcrumb-edit-cancel-button"
                        />
                    </>}
                    <SettingsDropdown showHidden={showHidden} setShowHidden={setShowHidden} />
                </FlexItem>
            </Flex>
        </PageBreadcrumb>
    );
}
