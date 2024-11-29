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
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';

import cockpit from 'cockpit';
import type { BasicError } from 'cockpit';
import { InlineNotification } from 'cockpit-components-inline-notification';
import type { Dialogs, DialogResult } from 'dialogs';
import { useInit } from 'hooks';
import { etc_group_syntax, etc_passwd_syntax } from 'pam_user_parser';
import type { PamCommon, PasswdUserInfo, EtcGroupInfo } from 'pam_user_parser';
import * as python from "python";
import { superuser } from 'superuser';
import { fmt_to_fragments } from 'utils.tsx';

import type { FolderFileInfo } from '../app.tsx';
import { inode_types } from '../common.ts';

// Following python file is loaded as a string (esbuild loader: text)
// @ts-expect-error Cannot find module or its corresponding type declaration
import read_selinux_context from './read-selinux.py';

const _ = cockpit.gettext;

const PERMISSION_OPTIONS: Record<number, string> = {
    0: "no-access",
    1: "no-access",
    2: "write-only",
    3: "write-only",
    4: "read-only",
    5: "read-only",
    6: "read-write",
    7: "read-write",
};

const OPTIONS_PERMISSIONS: Record<string, number> = {
    "no-access": 0,
    "write-only": 2,
    "read-only": 4,
    "read-write": 6,
};

// Convert the permissions mode to string based permissions to support
// passing `+X` to chmod which cannot be combined with numeric mode.
// Cockpit wants to pass `+X` for changing a folder and its contents, this only
// makes folders executable and retains the executable bits on a file and
// compared to `+x` does not make every file executable in a directory.
function mode_to_args(mode: number) {
    const offset_map: Record<number, string> = {
        6: 'u',
        3: 'g',
        0: 'o',
    };

    const letter_map: Record<number, string> = {
        4: 'r',
        2: 'w',
        1: 'X',
    };

    const chmod_args = [];
    for (const offset_str of Object.keys(offset_map)) {
        const offset = parseInt(offset_str, 10);
        const single_mode = (mode >> offset) & 0o7;
        let chmod_add = "";
        let chmod_rem = "";

        for (const digit_str of Object.keys(letter_map)) {
            // An object's keys are automatically converted to a string
            const digit = parseInt(digit_str, 10);
            if ((single_mode & digit) === digit) {
                chmod_add += letter_map[digit];
            } else {
                // Removal needs -x not -X
                chmod_rem += letter_map[digit].toLowerCase();
            }
        }

        if (chmod_add.length !== 0) {
            chmod_add = "+" + chmod_add;
        }

        if (chmod_rem.length !== 0) {
            chmod_rem = "-" + chmod_rem;
        }

        chmod_args.push(`${offset_map[offset]}${chmod_add}${chmod_rem}`);
    }

    return chmod_args.join(",");
}

const EditPermissionsModal = ({ dialogResult, selected, path } : {
    dialogResult: DialogResult<void>,
    selected: FolderFileInfo,
    path: string,
}) => {
    const [owner, setOwner] = useState(selected.user);
    const [mode, setMode] = useState(selected.mode ?? 0);
    const [group, setGroup] = useState(selected.group);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<PasswdUserInfo[] | null>(null);
    const [groups, setGroups] = useState<EtcGroupInfo[] | null>(null);
    const [isExecutable, setIsExecutable] = useState((mode & 0b001001001) === 0b001001001);
    const [selinuxContext, setSELinuxContext] = useState<string | null>(null);

    const full_path = path + selected.name;
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

        try {
            const selinux_context = await python.spawn(read_selinux_context, [full_path]);
            setSELinuxContext(selinux_context);
        } catch (err) {
            const e = err as python.PythonExitStatus;
            if (e.exit_status !== 2)
                console.error("Cannot obtain SELinux context", err);
        }
    });

    const changeOwner = (owner: string) => {
        setOwner(owner);
        const currentOwner = accounts?.find(a => a.name === owner);
        const currentGroup = groups?.find(g => g.name === group);
        if (currentOwner && currentGroup?.gid !== currentOwner?.gid &&
            !currentGroup?.userlist.includes(currentOwner?.name)) {
            setGroup(groups?.find(g => g.gid === currentOwner.gid)?.name);
        }
    };

    const spawnEncloseFiles = async () => {
        try {
            await cockpit.spawn(["chmod", "-R", mode_to_args(mode), full_path],
                                { superuser: "try", err: "message" });
            dialogResult.resolve();
        } catch (err) {
            const e = err as BasicError;
            setErrorMessage(e.message);
        }
    };

    const spawnEditPermissions = async () => {
        const permissionChanged = mode !== selected.mode;
        const ownerChanged = owner !== selected.user || group !== selected.group;

        try {
            if (permissionChanged)
                await cockpit.spawn(["chmod", mode.toString(8), full_path],
                                    { superuser: "try", err: "message" });

            if (ownerChanged)
                await cockpit.spawn(["chown", owner + ":" + group, full_path],
                                    { superuser: "try", err: "message" });

            dialogResult.resolve();
        } catch (err) {
            const e = err as BasicError;
            setErrorMessage(e.message);
        }
    };

    function permissions_options(mode: number) {
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

    function setPermissions(mask: number, shift: number, option: string) {
        let val = OPTIONS_PERMISSIONS[option];
        if ((selected?.type === 'reg' && isExecutable) || (selected?.type === 'dir' && option !== "no-access")) {
            val += 1;
        }

        setMode((mode & mask) | (val << shift));
    }

    function setExecutableBits(shouldBeExecutable: boolean) {
        setIsExecutable(shouldBeExecutable);

        // Strip / add executable bits
        if (shouldBeExecutable) {
            setMode(mode | 0b001001001);
        } else {
            setMode(mode & ~0b001001001);
        }
    }

    function sortByName(a: PamCommon, b: PamCommon) {
        return a.name.localeCompare(b.name);
    }

    return (
        <Modal
          position="top"
          variant={ModalVariant.small}
          /* Translators: $0 represents a filename */
          title={fmt_to_fragments(_("$0 permissions"), <b>{selected.name}</b>)}
          description={(selected.type) ? inode_types[selected.type] : _("Missing type")}
          isOpen
          onClose={() => dialogResult.resolve()}
          footer={
              <>
                  <Button
                    variant="primary"
                    onClick={() => spawnEditPermissions()}
                  >
                      {_("Change")}
                  </Button>
                  {selected.type === "dir" &&
                  <Button
                    variant="secondary"
                    onClick={() => spawnEncloseFiles()}
                  >
                      {_("Change permissions for enclosed files")}
                  </Button>}
                  <Button variant="link" onClick={() => dialogResult.resolve()}>{_("Cancel")}</Button>
              </>
          }
        >
            <Stack>
                {errorMessage !== null &&
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
                        {selinuxContext !== null &&
                        <FormGroup
                          label={_("Security context")}
                        >
                            <TextInput
                              id="selinux-context"
                              value={selinuxContext}
                              readOnlyVariant="plain"
                            />
                        </FormGroup>}
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

export function edit_permissions(dialogs: Dialogs, selected: FolderFileInfo, path: string) {
    dialogs.run(EditPermissionsModal, { selected, path });
}
