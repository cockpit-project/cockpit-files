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

import cockpit from "cockpit";
import React, { useState } from "react";
import {
    Button,
    Form, FormGroup,
    FormSection,
    FormSelect,
    FormSelectOption,
    Modal, ModalVariant,
    Stack,
    TextInput,
} from "@patternfly/react-core";

import { useDialogs } from "dialogs.jsx";
import { InlineNotification } from "cockpit-components-inline-notification";
import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { useInit } from "hooks.js";
import {
    etc_group_syntax as etcGroupSyntax,
    etc_passwd_syntax as etcPasswdSyntax
} from "pam_user_parser.js";
import { superuser } from "superuser";

import { map_permissions, inode_types } from "./common";
import { useFilesContext } from "./app";

const _ = cockpit.gettext;

export const editPermissions = (Dialogs, selected, path) => {
    Dialogs.show(
        <EditPermissionsModal
          selected={selected} path={path}
        />
    );
};

export const ConfirmDeletionDialog = ({
    path,
    selected,
    setSelected,
}) => {
    const Dialogs = useDialogs();
    const [errorMessage, setErrorMessage] = useState(null);
    const [forceDelete, setForceDelete] = useState(false);

    let modalTitle;
    if (selected.length > 1) {
        modalTitle = cockpit.format(forceDelete ? _("Force delete $0 items") : _("Delete $0 items?"), selected.length);
    } else {
        const selectedItem = selected[0];
        if (selectedItem.type === "reg") {
            modalTitle = cockpit.format(
                forceDelete ? _("Force delete file $0?") : _("Delete file $0?"), selectedItem.name
            );
        } else if (selectedItem.type === "lnk") {
            modalTitle = cockpit.format(
                forceDelete ? _("Force delete link $0?") : _("Delete link $0?"), selectedItem.name
            );
        } else if (selectedItem.type === "dir") {
            modalTitle = cockpit.format(
                forceDelete ? _("Force delete directory $0?") : _("Delete directory $0?"), selectedItem.name
            );
        } else {
            modalTitle = cockpit.format(forceDelete ? _("Force delete $0") : _("Delete $0?"), selectedItem.name);
        }
    }

    const deleteItem = () => {
        const args = ["rm", "-r"];
        // TODO: Make force more sensible https://github.com/cockpit-project/cockpit-files/issues/363
        cockpit.spawn([...args, ...selected.map(f => path + f.name)], { err: "message", superuser: "try" })
                .then(() => {
                    setSelected([]);
                    Dialogs.close();
                })
                .catch(err => {
                    setErrorMessage(err.message);
                    setForceDelete(true);
                });
    };

    return (
        <Modal
          position="top"
          title={modalTitle}
          titleIconVariant="warning"
          variant={ModalVariant.medium}
          isOpen
          onClose={Dialogs.close}
          footer={
              <>
                  <Button variant="danger" onClick={deleteItem}>{_("Delete")}</Button>
                  <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
              </>
          }
        >
            {errorMessage &&
            <InlineNotification
              type="danger"
              text={errorMessage}
              isInline
            />}
        </Modal>
    );
};

const CreateDirectoryModal = ({ currentPath }) => {
    const Dialogs = useDialogs();
    const [name, setName] = useState("");
    const [nameError, setNameError] = useState(null);
    const [errorMessage, setErrorMessage] = useState(undefined);
    const { cwdInfo } = useFilesContext();
    const createDirectory = () => {
        const path = currentPath + name;
        cockpit.spawn(["mkdir", path], { superuser: "try", err: "message" })
                .then(Dialogs.close, err => setErrorMessage(err.message));
    };

    return (
        <Modal
          position="top"
          title={_("Create directory")}
          isOpen
          onClose={Dialogs.close}
          variant={ModalVariant.small}
          footer={
              <>
                  <Button
                    variant="primary"
                    onClick={createDirectory}
                    isDisabled={errorMessage !== undefined || nameError !== null}
                  >
                      {_("Create")}
                  </Button>
                  <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
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
                <Form
                  isHorizontal onSubmit={e => {
                      createDirectory();
                      e.preventDefault();
                      return false;
                  }}
                >
                    <FormGroup fieldId="create-directory-input" label={_("Directory name")}>
                        <TextInput
                          validated={nameError ? "error" : "default"}
                          value={name}
                          onChange={(_, val) => setInputName(val, setName, setNameError, setErrorMessage, cwdInfo)}
                          id="create-directory-input" autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                        />
                        <FormHelper fieldId="create-directory-input" helperTextInvalid={nameError} />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};

const RenameItemModal = ({ path, selected }) => {
    const Dialogs = useDialogs();
    const { cwdInfo } = useFilesContext();
    const [name, setName] = useState(selected.name);
    const [nameError, setNameError] = useState(null);
    const [errorMessage, setErrorMessage] = useState(undefined);

    let title;
    if (selected.type === "reg") {
        title = cockpit.format(_("Rename file $0"), selected.name);
    } else if (selected.type === "lnk") {
        title = cockpit.format(_("Rename link $0"), selected.name);
    } else if (selected.type === "dir") {
        title = cockpit.format(_("Rename directory $0"), selected.name);
    } else {
        title = _("Rename $0", selected.name);
    }

    const renameItem = () => {
        const newPath = path.join("/") + "/" + name;

        cockpit.spawn(["mv", "--no-target-directory", path.join("/") + "/" + selected.name, newPath],
                      { superuser: "try", err: "message" })
                .then(() => {
                    Dialogs.close();
                }, err => setErrorMessage(err.message));
    };

    return (
        <Modal
          position="top"
          title={title}
          variant={ModalVariant.small}
          isOpen
          onClose={Dialogs.close}
          footer={
              <>
                  <Button
                    variant="primary"
                    onClick={renameItem}
                    isDisabled={errorMessage !== undefined || nameError !== null}
                  >
                      {_("Rename")}
                  </Button>
                  <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
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
                    <FormGroup fieldId="rename-item-input" label={_("New name")}>
                        <TextInput
                          value={name}
                          onChange={(_, val) => setInputName(val, setName, setNameError, setErrorMessage, cwdInfo)}
                          id="rename-item-input"
                        />
                        <FormHelper fieldId="rename-item-input" helperTextInvalid={nameError} />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};

const EditPermissionsModal = ({ selected, path }) => {
    const Dialogs = useDialogs();
    const { cwdInfo } = useFilesContext();

    // Nothing selected means we act on the current working directory
    if (!selected) {
        const directory_name = path[path.length - 1];
        selected = { ...cwdInfo, isCwd: true, name: directory_name };
    }

    const [owner, setOwner] = useState(selected.user);
    const [mode, setMode] = useState(selected.mode);
    const [group, setGroup] = useState(selected.group);
    const [errorMessage, setErrorMessage] = useState(undefined);
    const [accounts, setAccounts] = useState(null);
    const [groups, setGroups] = useState(null);

    useInit(async () => {
        try {
            const passwd = await cockpit.spawn(["getent", "passwd"], { err: "message" });
            setAccounts(etcPasswdSyntax.parse(passwd));
        } catch (exc) {
            console.error("Cannot obtain users from getent passwd", exc);
        }

        try {
            const group = await cockpit.spawn(["getent", "group"], { err: "message" });
            setGroups(etcGroupSyntax.parse(group));
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
            const directory = selected?.isCwd ? path.join("/") : path.join("/") + "/" + selected.name;
            if (permissionChanged)
                await cockpit.spawn(["chmod", mode.toString(8), directory],
                                    { superuser: "try", err: "message" });

            if (ownerChanged)
                await cockpit.spawn(["chown", owner + ":" + group, directory],
                                    { superuser: "try", err: "message" });

            Dialogs.close();
        } catch (err) {
            setErrorMessage(err.message);
        }
    };

    function permissions_options() {
        return [
            ...map_permissions((value, label) => (
                <FormSelectOption
                  key={value}
                  value={value}
                  label={label}
                />
            ))
        ];
    }

    function sortByName(a, b) {
        return a.name.localeCompare(b.name);
    }

    return (
        <Modal
          position="top"
          variant={ModalVariant.small}
          /* Translators: $0 represents a filename */
          title={cockpit.format(_("“$0” permissions"), selected.name)}
          description={inode_types[selected.type] || "Unknown type"}
          isOpen
          onClose={Dialogs.close}
          footer={
              <>
                  <Button
                    variant="primary"
                    onClick={() => spawnEditPermissions()}
                  >
                      {_("Change")}
                  </Button>
                  <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
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
                              value={(mode >> 6) & 7}
                              onChange={(_, val) => { setMode((mode & 0o077) | (val << 6)) }}
                              id="edit-permissions-owner-access"
                            >
                                {permissions_options()}
                            </FormSelect>
                        </FormGroup>
                        <FormGroup
                          label={_("Group access")}
                          fieldId="edit-permissions-group-access"
                        >
                            <FormSelect
                              value={(mode >> 3) & 7}
                              onChange={(_, val) => { setMode((mode & 0o707) | (val << 3)) }}
                              id="edit-permissions-group-access"
                            >
                                {permissions_options()}
                            </FormSelect>
                        </FormGroup>
                        <FormGroup
                          label={_("Others access")}
                          fieldId="edit-permissions-other-access"
                        >
                            <FormSelect
                              value={mode & 7}
                              onChange={(_, val) => { setMode((mode & 0o770) | val) }}
                              id="edit-permissions-other-access"
                            >
                                {permissions_options()}
                            </FormSelect>
                        </FormGroup>
                    </FormSection>
                </Form>
            </Stack>
        </Modal>
    );
};

const setInputName = (val, setName, setNameError, setErrorMessage, cwdInfo) => {
    setErrorMessage(undefined);
    setName(val);

    if (val === "") {
        setNameError(_("Name cannot be empty."));
    } else if (val.length >= 256) {
        setNameError(_("Name too long."));
    } else if (val.includes("/")) {
        setNameError(_("Name cannot include a /."));
    } else if (cwdInfo?.entries[val]) {
        setNameError(_("File or directory already exists"));
    } else {
        setNameError(null);
    }
};

const downloadFile = (currentPath, selected) => {
    const query = window.btoa(JSON.stringify({
        payload: "fsread1",
        binary: "raw",
        path: `${currentPath}/${selected.name}`,
        superuser: "try",
        external: {
            "content-disposition": `attachment; filename="${selected.name}"`,
            "content-type": "application/octet-stream",
        }
    }));

    const prefix = (new URL(cockpit.transport.uri("channel/" + cockpit.transport.csrf_token))).pathname;
    window.open(`${prefix}?${query}`);
};

export const fileActions = (path, selected, setSelected, clipboard, setClipboard, addAlert, Dialogs) => {
    const currentPath = path.join("/") + "/";
    const menuItems = [];

    const spawnPaste = (sourcePaths, targetPath) => {
        cockpit.spawn([
            "cp",
            "-R",
            ...sourcePaths,
            targetPath
        ]).catch(err => addAlert(err.message, "danger", new Date().getTime()));
    };

    if (selected.length === 0 || selected[0].name === path[path.length - 1]) {
        menuItems.push(
            {
                id: "paste-item",
                title: _("Paste"),
                onClick: () => spawnPaste(clipboard, currentPath),
                isDisabled: clipboard.length === 0
            },
            { type: "divider" },
            {
                id: "create-item",
                title: _("Create directory"),
                onClick: () => Dialogs.show(<CreateDirectoryModal currentPath={currentPath} />),
            },
            { type: "divider" },
            {
                id: "edit-permissions",
                title: _("Edit permissions"),
                onClick: () => editPermissions(Dialogs, selected[0], path)
            }
        );
    } else if (selected.length === 1) {
        menuItems.push(
            {
                id: "copy-item",
                title: _("Copy"),
                onClick: () => setClipboard([currentPath + selected[0].name]),
            },
            { type: "divider" },
            {
                id: "edit-permissions",
                title: _("Edit permissions"),
                onClick: () => editPermissions(Dialogs, selected[0], path)
            },
            {
                id: "rename-item",
                title: _("Rename"),
                onClick: () => {
                    Dialogs.show(
                        <RenameItemModal
                          path={path}
                          selected={selected[0]}
                        />
                    );
                },
            },
            { type: "divider" },
            {
                id: "delete-item",
                title: _("Delete"),
                className: "pf-m-danger",
                onClick: () => {
                    Dialogs.show(
                        <ConfirmDeletionDialog
                          selected={selected} path={currentPath}
                          setSelected={setSelected}
                        />
                    );
                }
            },
        );
        if (selected[0].type === "reg")
            menuItems.push(
                { type: "divider" },
                {
                    id: "download-item",
                    title: _("Download"),
                    onClick: () => downloadFile(currentPath, selected[0])
                }
            );
    } else if (selected.length > 1) {
        menuItems.push(
            {
                id: "copy-item",
                title: _("Copy"),
                onClick: () => setClipboard(selected.map(s => path.join("/") + "/" + s.name)),
            },
            {
                id: "delete-item",
                title: _("Delete"),
                className: "pf-m-danger",
                onClick: () => {
                    Dialogs.show(
                        <ConfirmDeletionDialog
                          selected={selected} path={currentPath}
                          setSelected={setSelected}
                        />
                    );
                },
            }
        );
    }

    return menuItems;
};
