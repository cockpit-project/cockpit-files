/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2024 Red Hat, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import React, { useEffect, useState } from 'react';

import { AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Modal, ModalVariant } from "@patternfly/react-core/dist/esm/components/Modal";

import cockpit from 'cockpit';
import type { Dialogs, DialogResult } from 'dialogs';
import { superuser } from 'superuser';

import { useFilesContext } from '../app.tsx';
import type { ClipboardInfo } from '../app.tsx';
import { get_owner_candidates } from '../ownership.tsx';

const _ = cockpit.gettext;

async function pasteAsOwner(clipboard: ClipboardInfo, dstPath: string, owner: string,
    addAlert: (title: string, variant: AlertVariant, key: string, detail?: string) => void) {
    try {
        await cockpit.spawn([
            "cp",
            "--recursive",
            ...clipboard.files.map(file => clipboard.path + file.name),
            dstPath
        ], { superuser: "try" });

        await cockpit.spawn([
            "chown",
            "--recursive",
            owner,
            ...clipboard.files.map(file => dstPath + file.name),
        ], { superuser: "try" });
    } catch (err) {
        const e = err as cockpit.BasicError;
        addAlert(e.message, AlertVariant.danger, `${new Date().getTime()}`);
    }
}

const CopyPasteAsOwnerModal = ({
    clipboard,
    dialogResult,
    path,
} : {
    clipboard: ClipboardInfo,
    dialogResult: DialogResult<void>,
    path: string,
}) => {
    const [currentUser, setCurrentUser] = useState<cockpit.UserInfo| undefined>();
    const [selectedOwner, setSelectedOwner] = useState<string | undefined>();
    const { cwdInfo, addAlert } = useFilesContext();

    useEffect(() => {
        cockpit.user().then(user => setCurrentUser(user));
    }, []);

    const candidates = [];
    if (superuser.allowed && currentUser && cwdInfo) {
        candidates.push(...get_owner_candidates(currentUser, cwdInfo));
        if (selectedOwner === undefined) {
            setSelectedOwner(candidates[0]);
        }
    }

    if (selectedOwner === undefined) {
        return;
    }

    const modalFooter = (
        <>
            <Button
              variant="warning"
              onClick={() => {
                  pasteAsOwner(clipboard, path, selectedOwner, addAlert);
                  dialogResult.resolve();
              }}
            >
                {_("Paste")}
            </Button>
            <Button variant="link" onClick={() => dialogResult.resolve()}>{_("Cancel")}</Button>
        </>
    );

    return (
        <Modal
          id="paste-owner-modal"
          position="top"
          title={_("Select owner of pasted files")}
          titleIconVariant="warning"
          isOpen
          onClose={() => dialogResult.resolve()}
          variant={ModalVariant.small}
          footer={modalFooter}
        >
            <Form isHorizontal>
                <FormGroup fieldId="paste-as-owner" label={_("Paste files as")}>
                    <FormSelect
                      id='paste-owner-select'
                      value={selectedOwner}
                      onChange={(_ev, val) => setSelectedOwner(val)}
                    >
                        {candidates.map(user =>
                            <FormSelectOption
                              key={user}
                              value={user}
                              label={user}
                            />)}
                    </FormSelect>
                </FormGroup>

            </Form>

        </Modal>
    );
};

export function show_copy_paste_as_owner(dialogs: Dialogs, clipboard: ClipboardInfo, path: string) {
    dialogs.run(CopyPasteAsOwnerModal, { clipboard, path });
}
