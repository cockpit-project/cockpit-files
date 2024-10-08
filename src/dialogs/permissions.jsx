/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
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

import React, { useState } from 'react';

import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Checkbox } from '@patternfly/react-core/dist/esm/components/Checkbox';
import { Form, FormGroup, FormSection } from '@patternfly/react-core/dist/esm/components/Form';
import { FormSelect, FormSelectOption } from '@patternfly/react-core/dist/esm/components/FormSelect';
import { Modal, ModalVariant } from '@patternfly/react-core/dist/esm/components/Modal';
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';

import cockpit from 'cockpit';
import { InlineNotification } from 'cockpit-components-inline-notification';
import { basename } from "cockpit-path";
import { useInit } from 'hooks';
import { etc_group_syntax, etc_passwd_syntax } from 'pam_user_parser';
import { superuser } from 'superuser';
import { fmt_to_fragments } from 'utils.tsx';

import { useFilesContext } from '../app.tsx';
import { inode_types } from '../common.ts';

const _ = cockpit.gettext;

const PERMISSION_OPTIONS = {
    0: "no-access",
    1: "no-access",
    2: "write-only",
    3: "write-only",
    4: "read-only",
    5: "read-only",
    6: "read-write",
    7: "read-write",
};

const OPTIONS_PERMISSIONS = {
    "no-access": 0,
    "write-only": 2,
    "read-only": 4,
    "read-write": 6,
};

const EditPermissionsModal = ({ dialogResult, selected, path }) => {
    const { cwdInfo } = useFilesContext();

    // Nothing selected means we act on the current working directory
    if (!selected) {
        const directory_name = basename(path);
        selected = { ...cwdInfo, isCwd: true, name: directory_name };
    }

    const [owner, setOwner] = useState(selected.user);
    const [mode, setMode] = useState(selected.mode);
    const [group, setGroup] = useState(selected.group);
    const [errorMessage, setErrorMessage] = useState(undefined);
    const [accounts, setAccounts] = useState(null);
    const [groups, setGroups] = useState(null);
    const [isExecutable, setIsExecutable] = useState((mode & 0b001001001) === 0b001001001);

    const executable_file_types = ["code-file", "file"];

    useInit(async () => {
        try {
            const passwd = await cockpit.spawn(["getent", "passwd"], { err: "message" });
            setAccounts(etc_passwd_syntax.parse(passwd));
        } catch (exc) {
            console.error("Cannot obtain users from getent passwd", exc);
        }

        try {
            const group = await cockpit.spawn(["getent", "group"], { err: "message" });
            setGroups(etc_group_syntax.parse(group));
        } catch (exc) {
            console.error("Cannot obtain users from getent group", exc);
        }
    });

    const changeOwner = (owner) => {
        setOwner(owner);
        const currentOwner = accounts.find(a => a.name === owner);
        const currentGroup = groups.find(g => g.name === group);
        if (currentGroup?.gid !== currentOwner?.gid && !currentGroup?.userlist.includes(currentOwner?.name)) {
            setGroup(groups.find(g => g.gid === currentOwner.gid).name);
        }
    };

    const spawnEditPermissions = async () => {
        const permissionChanged = mode !== selected.mode;
        const ownerChanged = owner !== selected.user || group !== selected.group;

        try {
            const directory = selected?.isCwd ? path : path + selected.name;
            if (permissionChanged)
                await cockpit.spawn(["chmod", mode.toString(8), directory],
                                    { superuser: "try", err: "message" });

            if (ownerChanged)
                await cockpit.spawn(["chown", owner + ":" + group, directory],
                                    { superuser: "try", err: "message" });

            dialogResult.resolve();
        } catch (err) {
            setErrorMessage(err.message);
        }
    };

    function permissions_options(mode) {
        const options = [
            <FormSelectOption
              key="read-write"
              value="read-write"
              label={_("Read and write")}
            />,
            <FormSelectOption
              key="read-only"
              value="read-only"
              label={_("Read-only")}
            />,
            <FormSelectOption
              key="no-access"
              value="no-access"
              label={_("No access")}
            />
        ];

        // Show write-only when such a file exists, but never offer this as a default option.
        if (mode === 2 || mode === 3) {
            options.push(
                <FormSelectOption
                  key="write-only"
                  value="write-only"
                  label={_("Write-only")}
                />
            );
        }

        return options;
    }

    function setPermissions(mask, shift, option) {
        let val = OPTIONS_PERMISSIONS[option];
        if ((selected.type === 'reg' && isExecutable) || (selected.type === 'dir' && option !== "no-access")) {
            val += 1;
        }

        setMode((mode & mask) | (val << shift));
    }

    function setExecutableBits(shouldBeExecutable) {
        setIsExecutable(shouldBeExecutable);

        // Strip / add executable bits
        if (shouldBeExecutable) {
            setMode(mode | 0b001001001);
        } else {
            setMode(mode & ~0b001001001);
        }
    }

    function sortByName(a, b) {
        return a.name.localeCompare(b.name);
    }

    return (
        <Modal
          position="top"
          variant={ModalVariant.small}
          /* Translators: $0 represents a filename */
          title={fmt_to_fragments(_("$0 permissions"), <b>{selected.name}</b>)}
          description={inode_types[selected.type] || "Unknown type"}
          isOpen
          onClose={dialogResult.resolve}
          footer={
              <>
                  <Button
                    variant="primary"
                    onClick={() => spawnEditPermissions()}
                  >
                      {_("Change")}
                  </Button>
                  <Button variant="link" onClick={dialogResult.resolve}>{_("Cancel")}</Button>
              </>
          }
        >
            <Stack>
                {errorMessage !== undefined &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                />}
                <Form isHorizontal>
                    {superuser.allowed && accounts && groups &&
                    <FormSection title={_("Ownership")}>
                        <FormGroup label={_("Owner")} fieldId="edit-permissions-owner">
                            <FormSelect
                              onChange={(_, val) => changeOwner(val)} id="edit-permissions-owner"
                              value={owner}
                            >
                                {accounts?.sort(sortByName).map(a => {
                                    return (
                                        <FormSelectOption
                                          key={a.name} label={a.name}
                                          value={a.name}
                                        />
                                    );
                                })}
                            </FormSelect>
                        </FormGroup>
                        <FormGroup label={_("Group")} fieldId="edit-permissions-group">
                            <FormSelect
                              onChange={(_, val) => setGroup(val)} id="edit-permissions-group"
                              value={group}
                            >
                                {groups?.sort(sortByName).map(g => {
                                    return (
                                        <FormSelectOption
                                          key={g.name} label={g.name}
                                          value={g.name}
                                        />
                                    );
                                })}
                            </FormSelect>
                        </FormGroup>
                    </FormSection>}
                    <FormSection title={_("Access")}>
                        <FormGroup
                          label={_("Owner access")}
                          fieldId="edit-permissions-owner-access"
                        >
                            <FormSelect
                              value={PERMISSION_OPTIONS[(mode >> 6) & 7]}
                              onChange={(_, val) => { setPermissions(0o077, 6, val) }}
                              id="edit-permissions-owner-access"
                            >
                                {permissions_options((mode >> 6) & 7)}
                            </FormSelect>
                        </FormGroup>
                        <FormGroup
                          label={_("Group access")}
                          fieldId="edit-permissions-group-access"
                        >
                            <FormSelect
                              value={PERMISSION_OPTIONS[(mode >> 3) & 7]}
                              onChange={(_, val) => { setPermissions(0o707, 3, val) }}
                              id="edit-permissions-group-access"
                            >
                                {permissions_options((mode >> 3) & 7)}
                            </FormSelect>
                        </FormGroup>
                        <FormGroup
                          label={_("Others access")}
                          fieldId="edit-permissions-other-access"
                        >
                            <FormSelect
                              value={PERMISSION_OPTIONS[(mode) & 7]}
                              onChange={(_, val) => { setPermissions(0o770, 0, val) }}
                              id="edit-permissions-other-access"
                            >
                                {permissions_options(mode & 7)}
                            </FormSelect>
                        </FormGroup>
                    </FormSection>
                    {selected.type === "reg" && executable_file_types.includes(selected?.category?.class || "file") &&
                        <Checkbox
                          id="is-executable"
                          label={_("Set executable as program")}
                          isChecked={isExecutable}
                          onChange={() => setExecutableBits(!isExecutable)}
                        />}
                </Form>
            </Stack>
        </Modal>
    );
};

export function edit_permissions(dialogs, selected, path) {
    dialogs.run(EditPermissionsModal, { selected, path });
}
