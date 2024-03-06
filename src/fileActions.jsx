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
import React, { useEffect, useState } from "react";
import {
    Button,
    Form, FormGroup,
    FormSection,
    FormSelect,
    FormSelectOption,
    Modal, ModalVariant,
    Radio,
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
import { FileAutoComplete } from "../pkg/lib/cockpit-components-file-autocomplete";
import {
    spawnCreateDirectory,
    spawnCreateLink,
    spawnDeleteItem,
    spawnEditPermissions,
    spawnForceDelete,
    spawnPaste,
    spawnRenameItem
} from "./apis/spawnHelpers";
import { map_permissions, inode_types } from "./common";

const _ = cockpit.gettext;

export const editPermissions = (Dialogs, selected, path) => {
    Dialogs.show(
        <EditPermissionsModal
          selected={selected} path={path}
        />
    );
};

const ConfirmDeletionDialog = ({
    path,
    selected,
    setSelected,
}) => {
    const Dialogs = useDialogs();

    let modalTitle;
    if (selected.length > 1) {
        modalTitle = cockpit.format(_("Delete $0 items?"), selected.length);
    } else {
        const selectedItem = selected[0];
        if (selectedItem.type === "reg") {
            modalTitle = cockpit.format(_("Delete file $0?"), selectedItem.name);
        } else if (selectedItem.type === "lnk") {
            modalTitle = cockpit.format(_("Delete link $0?"), selectedItem.name);
        } else if (selectedItem.type === "dir") {
            modalTitle = cockpit.format(_("Delete directory $0?"), selectedItem.name);
        } else {
            modalTitle = cockpit.format(_("Delete $0?"), selectedItem.name);
        }
    }

    const deleteItem = () => {
        spawnDeleteItem(path, selected, setSelected, Dialogs);
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
        />
    );
};

export const ForceDeleteModal = ({ selected, path, initialError }) => {
    const Dialogs = useDialogs();
    const [errorMessage, setErrorMessage] = useState(initialError);
    const [deleteFailed, setDeleteFailed] = useState(false);

    let modalTitle;
    if (selected.length > 1)
        modalTitle = cockpit.format(_("Force delete $0 items?"), selected.length);
    else {
        const selectedItem = Array.isArray(selected)
            ? selected[0]
            : selected;
        if (selectedItem.type === "reg") {
            modalTitle = cockpit.format(_("Force delete file $0?"), selectedItem.name);
        } else if (selectedItem.type === "lnk") {
            modalTitle = cockpit.format(_("Force delete link $0?"), selectedItem.name);
        } else if (selectedItem.type === "dir") {
            modalTitle = cockpit.format(_("Force delete directory $0?"), selectedItem.name);
        } else {
            modalTitle = _("Force delete $0?", selectedItem.name);
        }
    }

    const forceDeleteItem = () => {
        spawnForceDelete(path, selected, setDeleteFailed, setErrorMessage, Dialogs);
    };

    return (
        <Modal
          position="top"
          title={modalTitle}
          titleIconVariant="warning"
          variant={ModalVariant.small}
          isOpen
          onClose={Dialogs.close}
          footer={!deleteFailed &&
          <>
              <Button variant="danger" onClick={forceDeleteItem}>{_("Force delete")}</Button>
              <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
          </>}
        >
            <InlineNotification
              type="danger"
              text={errorMessage}
              isInline
            />
        </Modal>
    );
};

const CreateDirectoryModal = ({ currentPath }) => {
    const Dialogs = useDialogs();
    const [name, setName] = useState("");
    const [nameError, setNameError] = useState(null);
    const [errorMessage, setErrorMessage] = useState(undefined);
    const createDirectory = () => spawnCreateDirectory(name, currentPath, Dialogs, setErrorMessage);

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

const RenameItemModal = ({ path, selected }) => {
    const Dialogs = useDialogs();
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
        spawnRenameItem(selected, name, path, Dialogs, setErrorMessage);
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

const CreateLinkModal = ({ currentPath, selected }) => {
    const Dialogs = useDialogs();
    const [originalName, setOriginalName] = useState(selected?.name || "");
    const [newName, setNewName] = useState("");
    const [type, setType] = useState("symbolic");
    const [errorMessage, setErrorMessage] = useState(undefined);

    const createLink = () => {
        spawnCreateLink(type, currentPath, originalName, newName, Dialogs, setErrorMessage);
    };

    return (
        <Modal
          position="top"
          variant={ModalVariant.small}
          title={_("New link")}
          isOpen
          onClose={Dialogs.close}
          footer={
              <>
                  <Button variant="primary" onClick={createLink}>{_("Create link")}</Button>
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
                    <FormGroup label={_("Original")}>
                        <div id="create-link-original-wrapper">
                            <FileAutoComplete
                              onChange={setOriginalName} placeholder={_("Path to file")}
                              superuser="try" value={currentPath + originalName}
                              id="create-link-original"
                            />
                        </div>
                    </FormGroup>
                    <FormGroup label={_("New")}>
                        <TextInput
                          value={newName} onChange={(_, val) => setNewName(val)}
                          id="create-link-new"
                        />
                    </FormGroup>
                    <FormGroup label={_("Link type")} isInline>
                        <Radio
                          name="create-link-type" label={_("Symbolic")}
                          value="symbolic" onChange={() => { setType("symbolic") }}
                          id="create-link-symbolic" isChecked={type === "symbolic"}
                        />
                        <Radio
                          name="create-link-type" label={_("Hard")}
                          value="new" onChange={() => { setType("hard") }}
                          id="create-link-hard" isChecked={type === "hard"}
                        />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};

const EditPermissionsModal = ({ selected, path }) => {
    const Dialogs = useDialogs();
    const [owner, setOwner] = useState(selected.user);
    const [mode, setMode] = useState(selected.mode);
    const [group, setGroup] = useState(selected.group);
    const [errorMessage, setErrorMessage] = useState(undefined);
    const accounts = useFile("/etc/passwd", { syntax: etcPasswdSyntax });
    const groups = useFile("/etc/group", { syntax: etcGroupSyntax });
    const logindef = useFile("/etc/login.defs", { superuser: true });

    if (!selected) {
        const directory_name = path[path.length - 1];
        selected = { name: directory_name, type: "dir" };
    }

    //  Handle also the case where logindef == null, i.e. the file does not exist.
    //  While that's unusual, "empty /etc" is a goal, and it shouldn't crash the page.
    const [minGid, setMinGid] = useState(500);
    const [maxGid, setMaxGid] = useState(60000);
    const [minUid, setMinUid] = useState(500);
    const [maxUid, setMaxUid] = useState(60000);
    useEffect(() => {
        if (!logindef)
            return;

        const minGid = parseInt(logindef.match(/^GID_MIN\s+(\d+)/m)[1]);
        const maxGid = parseInt(logindef.match(/^GID_MAX\s+(\d+)/m)[1]);
        const minUid = parseInt(logindef.match(/^UID_MIN\s+(\d+)/m)[1]);
        const maxUid = parseInt(logindef.match(/^UID_MAX\s+(\d+)/m)[1]);

        if (minGid)
            setMinGid(minGid);
        if (maxGid)
            setMaxGid(maxGid);
        if (minUid)
            setMinUid(minUid);
        if (maxUid)
            setMaxUid(maxUid);
    }, [logindef]);

    let filteredAccounts, filteredGroups;
    if (accounts && groups) {
        filteredAccounts = accounts.filter(a => a.uid >= minUid && a.uid <= maxUid);
        filteredGroups = groups.filter(g => g.gid >= minGid && g.gid <= maxGid);
    }

    const changeOwner = (owner) => {
        setOwner(owner);
        const currentOwner = filteredAccounts.find(a => a.name === owner);
        const currentGroup = filteredGroups.find(g => g.name === group);
        if (currentGroup?.gid !== currentOwner?.gid && !currentGroup?.userlist.includes(currentOwner?.name)) {
            setGroup(filteredGroups.find(g => g.gid === currentOwner.gid).name);
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
                    onClick={() => spawnEditPermissions(mode, path, selected, owner, group, Dialogs, setErrorMessage)}
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
                    <FormSection title={_("Ownership")}>
                        <FormGroup label={_("Owner")} fieldId="edit-permissions-owner">
                            <FormSelect
                              onChange={(_, val) => changeOwner(val)} id="edit-permissions-owner"
                              value={owner}
                            >
                                {filteredAccounts?.map(a => {
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
                                {filteredGroups?.map(g => {
                                    return (
                                        <FormSelectOption
                                          key={g.name} label={g.name}
                                          value={g.name}
                                        />
                                    );
                                })}
                            </FormSelect>
                        </FormGroup>
                    </FormSection>
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
    } else {
        setNameError(null);
    }
};

export const fileActions = (path, files, selected, setSelected, clipboard, setClipboard, addAlert, Dialogs) => {
    const currentPath = path.join("/") + "/";
    const menuItems = [];

    const createLink = (currentPath, files, selected) => {
        Dialogs.show(
            <CreateLinkModal
              currentPath={currentPath} selected={selected}
              files={files.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase())
                  ? 1
                  : ((b.name.toLowerCase() > a.name.toLowerCase())
                      ? -1
                      : 0))}
            />
        );
    };

    if (selected.length === 0 || selected[0].name === path[path.length - 1]) {
        menuItems.push(
            {
                id: "paste-item",
                title: _("Paste"),
                onClick: () => spawnPaste(clipboard, currentPath, false, addAlert),
                isDisabled: clipboard === undefined
            },
            {
                id: "paste-as-symlink",
                title: _("Paste as symlink"),
                onClick: () => spawnPaste(clipboard, currentPath, true, addAlert),
                isDisabled: clipboard === undefined
            },
            { type: "divider" },
            {
                id: "create-item",
                title: _("Create directory"),
                onClick: () => Dialogs.show(<CreateDirectoryModal currentPath={currentPath} />),
            },
            {
                id: "create-link",
                title: _("Create link"),
                onClick: () => createLink(currentPath, files, selected || {})
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
            ...(selected[0].type === "dir")
                ? [
                    {
                        id: "paste-into-directory",
                        title: _("Paste into directory"),
                        onClick: () => spawnPaste(clipboard, [currentPath + selected[0].name], false, addAlert),
                        isDisabled: clipboard === undefined
                    }
                ]
                : [],
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
                id: "create-link",
                title: _("Create link"),
                onClick: () => createLink(currentPath, files, selected[0]),
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
