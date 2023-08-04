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
    Modal,
    Radio,
    Stack,
    TextInput,
} from "@patternfly/react-core";

import { useDialogs } from "dialogs.jsx";
import { InlineNotification } from "cockpit-components-inline-notification";
import { FileAutoComplete } from "../pkg/lib/cockpit-components-file-autocomplete";

const _ = cockpit.gettext;

export const createDirectory = (Dialogs, currentPath, selected) => {
    Dialogs.show(<CreateDirectoryModal currentPath={currentPath} selected={selected} />);
};

export const createLink = (Dialogs, currentPath, files, selected) => {
    Dialogs.show(
        <CreateLinkModal
          currentPath={currentPath} selected={selected}
          files={files.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0))}
        />);
};

export const deleteItem = (Dialogs, options) => {
    Dialogs.show(
        <ConfirmDeletionDialog
          selected={options.selected} itemPath={options.itemPath}
          path={options.path} setPath={options.setPath}
          setHistory={options.setHistory} setHistoryIndex={options.setHistoryIndex}
        />);
};

export const renameItem = (Dialogs, options) => {
    Dialogs.show(
        <RenameItemModal
          path={options.path} setPath={options.setPath}
          selected={options.selected}
        />);
};

export const ConfirmDeletionDialog = ({ selected, itemPath, path, setPath, setHistory, setHistoryIndex }) => {
    const Dialogs = useDialogs();

    const deleteItem = () => {
        const options = { err: "message", superuser: "try" };

        cockpit.spawn(["rm", "-r", itemPath], options)
                .then(() => {
                    if (selected.items_cnt) {
                        setPath(path.slice(0, -1));
                        setHistory(h => h.slice(0, -1));
                        setHistoryIndex(i => i - 1);
                    }
                })
                .then(Dialogs.close, (err) => {
                    Dialogs.show(
                        <ForceDeleteModal
                          selected={selected} itemPath={itemPath}
                          errorMessage={err.message} deleteFailed={false}
                        />);
                });
    };

    const modalTitle = selected.type === "file"
        ? cockpit.format(_("Delete file $0?"), selected.name)
        : cockpit.format(_("Delete directory $0?"), selected.name);

    return (
        <Modal
          position="top"
          title={modalTitle}
          titleIconVariant="warning"
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

const ForceDeleteModal = ({ selected, itemPath, errorMessage, deleteFailed }) => {
    const Dialogs = useDialogs();

    const forceDelete = () => {
        const options = { err: "message", superuser: "try" };

        cockpit.spawn(["rm", "-rf", itemPath], options)
                .then(Dialogs.close, (err) => {
                    Dialogs.show(
                        <ForceDeleteModal
                          selected={selected} itemPath={itemPath}
                          errorMessage={err.message} deleteFailed
                        />);
                });
    };

    const modalTitle = selected.type === "file"
        ? cockpit.format(_("Force delete file $0?"), selected.name)
        : cockpit.format(_("Force delete directory $0?"), selected.name);

    return (
        <Modal
          position="top"
          title={modalTitle}
          titleIconVariant="warning"
          isOpen
          onClose={Dialogs.close}
          footer={!deleteFailed &&
          <>
              <Button variant="danger" onClick={forceDelete}>{_("Force delete")}</Button>
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

export const CreateDirectoryModal = ({ selected, currentPath, errorMessage }) => {
    const Dialogs = useDialogs();
    const [name, setName] = useState("");

    const createDirectory = () => {
        const options = { err: "message", superuser: "try" };
        let path;
        if (selected.icons_cnt || selected.type === "directory") {
            path = currentPath + selected.name + "/" + name;
        } else {
            path = currentPath + name;
        }
        cockpit.spawn(["mkdir", path], options)
                .then(Dialogs.close, (err) => { Dialogs.show(<CreateDirectoryModal currentPath={currentPath} errorMessage={err.message} />) });
    };

    return (
        <Modal
          position="top"
          title={_("Create directory")}
          isOpen
          onClose={Dialogs.close}
          footer={errorMessage === undefined &&
          <>
              <Button variant="primary" onClick={createDirectory}>{_("Create")}</Button>
              <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
          </>}
        >
            <Stack>
                {errorMessage !== undefined &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                />}
                <Form isHorizontal>
                    <FormGroup label={_("Directory name")}>
                        <TextInput
                          value={name} onChange={(_, val) => setName(val)}
                          id="create-directory-input"
                        />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};

export const RenameItemModal = ({ path, setPath, selected }) => {
    const Dialogs = useDialogs();
    const [name, setName] = useState(selected.name);
    const [errorMessage, setErrorMessage] = useState(undefined);

    const renameItem = () => {
        const options = { err: "message", superuser: "try" };
        const command = selected.items_cnt
            ? ["mv", "/" + path.join("/"), "/" + path.slice(0, -1).join("/") + "/" + name]
            : ["mv", "/" + path.join("/") + "/" + selected.name, "/" + path.join("/") + "/" + name];

        cockpit.spawn(command, options)
                .then(() => {
                    if (selected.items_cnt)
                        setPath(path.slice(0, -1).concat(name));
                    Dialogs.close();
                }, (err) => { setErrorMessage(err.message) });
    };

    return (
        <Modal
          position="top"
          title={selected.type === "file" ? _("Rename file") : _("Rename directory")}
          isOpen
          onClose={Dialogs.close}
          footer={errorMessage === undefined &&
          <>
              <Button variant="primary" onClick={renameItem}>{_("Rename")}</Button>
              <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
          </>}
        >
            <Stack>
                {errorMessage !== undefined &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                />}
                <Form isHorizontal>
                    <FormGroup label={selected.type === "file" ? _("File name") : _("Directory name")}>
                        <TextInput
                          value={name} onChange={(_, val) => setName(val)}
                          id="rename-item-input"
                        />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};

export const CreateLinkModal = ({ currentPath, files, selected }) => {
    const Dialogs = useDialogs();
    const [originalName, setOriginalName] = useState(selected?.name || "");
    const [newName, setNewName] = useState("");
    const [type, setType] = useState("symbolic");
    const [errorMessage, setErrorMessage] = useState(undefined);

    const createLink = () => {
        const options = { err: "message", superuser: "try" };
        cockpit.spawn(["ln", ...(type === "symbolic" ? ["-s"] : []), currentPath + originalName.slice(originalName.lastIndexOf("/") + 1), currentPath + newName], options)
                .then(Dialogs.close, (err) => { setErrorMessage(err.message) });
    };

    return (
        <Modal
          position="top"
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
