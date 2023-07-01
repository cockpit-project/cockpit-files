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

import cockpit from 'cockpit';
import { useDialogs } from "dialogs.jsx";
import React, { useState } from 'react';
import {
    Button,
    Modal,
    TextInput, Form, FormGroup, Stack,
} from "@patternfly/react-core";

import { InlineNotification } from "../pkg/lib/cockpit-components-inline-notification";

const _ = cockpit.gettext;

export const ConfirmDeletionDialog = ({ selected, itemPath, path, setPath, setPathIndex }) => {
    const Dialogs = useDialogs();

    const deleteItem = () => {
        const options = { err: "message", superuser: "try" };

        cockpit.spawn(["rm", "-r", itemPath], options)
                .then(() => {
                    if (selected.items_cnt) {
                        setPath(path.slice(0, -1));
                        setPathIndex(path.length - 1);
                    }
                })
                .then(Dialogs.close, (err) => { Dialogs.show(<ForceDeleteModal selected={selected} itemPath={itemPath} errorMessage={err.message} deleteFailed={false} />) });
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
                    <Button variant='danger' onClick={deleteItem}>{_("Delete")}</Button>
                    <Button variant='link' onClick={Dialogs.close}>{_("Cancel")}</Button>
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
                .then(Dialogs.close, (err) => { Dialogs.show(<ForceDeleteModal selected={selected} itemPath={itemPath} errorMessage={err.message} deleteFailed />) });
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
                    <Button variant='danger' onClick={forceDelete}>{_("Force delete")}</Button>
                    <Button variant='link' onClick={Dialogs.close}>{_("Cancel")}</Button>
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

export const CreateDirectoryModal = ({ currentPath, errorMessage }) => {
    const Dialogs = useDialogs();
    const [name, setName] = useState("");

    const createDirectory = () => {
        const options = { err: "message", superuser: "try" };

        cockpit.spawn(["mkdir", currentPath + name], options)
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
                    <Button variant='primary' onClick={createDirectory}>{_("Create")}</Button>
                    <Button variant='link' onClick={Dialogs.close}>{_("Cancel")}</Button>
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
                        <TextInput value={name} onChange={setName} id="create-directory-input" />
                    </FormGroup>
                </Form>
            </Stack>
        </Modal>
    );
};
