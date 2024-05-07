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
import { useFile } from "hooks.js";
import {
    etc_group_syntax as etcGroupSyntax,
    etc_passwd_syntax as etcPasswdSyntax
} from "pam_user_parser.js";
import { superuser } from "superuser";

import { map_permissions, inode_types } from "./common";
import { useFilesContext } from "./app";

const _ = cockpit.gettext;

export const editPermissions = (Dialogs, files, selected, path) => {
    Dialogs.show(
        <EditPermissionsModal
          files={files}
          selected={selected}
          path={path}
        />
    );
};

export const ConfirmDeletionDialog = ({
    path,
    files,
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
        const fileInfo = files[selected[0]];
        if (fileInfo?.type === "reg") {
            modalTitle = cockpit.format(
                forceDelete ? _("Force delete file $0?") : _("Delete file $0?"), selected[0]
            );
        } else if (fileInfo?.type === "lnk") {
            modalTitle = cockpit.format(
                forceDelete ? _("Force delete link $0?") : _("Delete link $0?"), selected[0]
            );
        } else if (fileInfo?.type === "dir") {
            modalTitle = cockpit.format(
                forceDelete ? _("Force delete directory $0?") : _("Delete directory $0?"), selected[0]
            );
        } else {
            modalTitle = cockpit.format(forceDelete ? _("Force delete $0") : _("Delete $0?"), selected[0]);
        }
    }

    const deleteItem = () => {
        const args = ["rm", "-r"];
        // TODO: Make force more sensible https://github.com/cockpit-project/cockpit-files/issues/363
        cockpit.spawn([...args, ...selected.map(f => path + f)], { err: "message", superuser: "try" })
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
                          onChange={(_, val) => setDirectoryName(val, setName, setNameError, setErrorMessage)}
                          id="create-directory-input" autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                        />
                        <FormHelper fieldId="create-directory-input" helperTextInvalid={nameError} />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};

const RenameItemModal = ({ path, files, selected }) => {
    const Dialogs = useDialogs();
    const [name, setName] = useState(selected);
    const [nameError, setNameError] = useState(null);
    const [errorMessage, setErrorMessage] = useState(undefined);

    const fileInfo = files[selected];

    let title;
    if (fileInfo?.type === "reg") {
        title = cockpit.format(_("Rename file $0"), selected);
    } else if (fileInfo?.type === "lnk") {
        title = cockpit.format(_("Rename link $0"), selected);
    } else if (fileInfo?.type === "dir") {
        title = cockpit.format(_("Rename directory $0"), selected);
    } else {
        title = _("Rename $0", selected);
    }

    const renameItem = () => {
        const newPath = path.join("/") + "/" + name;

        cockpit.spawn(["mv", path.join("/") + "/" + selected, newPath],
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
                          onChange={(_, val) => setDirectoryName(val, setName, setNameError, setErrorMessage)}
                          id="rename-item-input"
                        />
                        <FormHelper fieldId="rename-item-input" helperTextInvalid={nameError} />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};

const EditPermissionsModal = ({ files, selected, path }) => {
    const Dialogs = useDialogs();
    const { cwdInfo } = useFilesContext();

    let fileInfo = files[selected[0]];
    let filename = selected[0];
    // Nothing selected means we act on the current working directory
    if (selected.length === 0) {
        const directory_name = path[path.length - 1];
        fileInfo = { ...cwdInfo, isCwd: true };
        filename = directory_name;
    }
    cockpit.assert(fileInfo, `cannot obtain file information for ${filename}`);

    const [owner, setOwner] = useState(fileInfo.user);
    const [mode, setMode] = useState(fileInfo.mode);
    const [group, setGroup] = useState(fileInfo.group);
    const [errorMessage, setErrorMessage] = useState(undefined);
    const accounts = useFile("/etc/passwd", { syntax: etcPasswdSyntax });
    const groups = useFile("/etc/group", { syntax: etcGroupSyntax });

    const changeOwner = (owner) => {
        setOwner(owner);
        const currentOwner = accounts.find(a => a.name === owner);
        const currentGroup = groups.find(g => g.name === group);
        if (currentGroup?.gid !== currentOwner?.gid && !currentGroup?.userlist.includes(currentOwner?.name)) {
            setGroup(groups.find(g => g.gid === currentOwner.gid).name);
        }
    };

    const spawnEditPermissions = async () => {
        const permissionChanged = mode !== fileInfo.mode;
        const ownerChanged = owner !== fileInfo.user || group !== fileInfo.group;

        try {
            const directory = fileInfo?.isCwd ? path.join("/") : path.join("/") + "/" + filename;
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
          title={cockpit.format(_("“$0” permissions"), filename)}
          description={inode_types[fileInfo.type] || "Unknown type"}
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
                    {superuser.allowed &&
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

const setDirectoryName = (val, setName, setNameError, setErrorMessage) => {
    setErrorMessage(undefined);
    setName(val);

    if (val === "") {
        setNameError(_("Directory name cannot be empty."));
    } else if (val.length >= 256) {
        setNameError(_("Directory name too long."));
    } else if (val.includes("/")) {
        setNameError(_("Directory name cannot include a /."));
    } else {
        setNameError(null);
    }
};

const downloadFile = (currentPath, filename) => {
    const query = window.btoa(JSON.stringify({
        payload: "fsread1",
        binary: "raw",
        path: `${currentPath}/${filename}`,
        superuser: "try",
        external: {
            "content-disposition": `attachment; filename="${filename}"`,
            "content-type": "application/octet-stream",
        }
    }));

    const prefix = (new URL(cockpit.transport.uri("channel/" + cockpit.transport.csrf_token))).pathname;
    window.open(`${prefix}?${query}`);
};

export const fileActions = (files, path, selected, setSelected, clipboard, setClipboard, addAlert, Dialogs) => {
    const currentPath = path.join("/") + "/";
    const menuItems = [];

    const spawnPaste = (sourcePath, targetPath) => {
        cockpit.spawn([
            "cp",
            "-R",
            ...sourcePath,
            targetPath
        ]).catch(err => addAlert(err.message, "danger", new Date().getTime()));
    };

    if (selected.length === 0 || selected[0] === path[path.length - 1]) {
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
                onClick: () => editPermissions(Dialogs, files, selected, path)
            }
        );
    } else if (selected.length === 1) {
        const fileInfo = files[selected[0]];
        menuItems.push(
            {
                id: "copy-item",
                title: _("Copy"),
                onClick: () => setClipboard([currentPath + selected[0]]),
            },
            ...(fileInfo?.type === "dir")
                ? [
                    {
                        id: "paste-into-directory",
                        title: _("Paste into directory"),
                        onClick: () => spawnPaste(clipboard, [currentPath + selected[0]]),
                        isDisabled: clipboard.length === 0
                    }
                ]
                : [],
            { type: "divider" },
            {
                id: "edit-permissions",
                title: _("Edit permissions"),
                onClick: () => editPermissions(Dialogs, files, selected, path)
            },
            {
                id: "rename-item",
                title: _("Rename"),
                onClick: () => {
                    Dialogs.show(
                        <RenameItemModal
                          files={files}
                          path={path}
                          selected={selected}
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
                          files={files}
                          selected={selected}
                          path={currentPath}
                          setSelected={setSelected}
                        />
                    );
                }
            },
        );
        if (fileInfo?.type === "reg")
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
                onClick: () => setClipboard(selected.map(s => path.join("/") + "/" + s)),
            },
            {
                id: "delete-item",
                title: _("Delete"),
                className: "pf-m-danger",
                onClick: () => {
                    Dialogs.show(
                        <ConfirmDeletionDialog
                          path={currentPath}
                          files={files}
                          selected={selected}
                          setSelected={setSelected}
                        />
                    );
                },
            }
        );
    }

    return menuItems;
};
