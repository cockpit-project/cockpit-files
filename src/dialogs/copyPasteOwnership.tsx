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
import { Text, TextContent } from "@patternfly/react-core/dist/esm/components/Text";

import cockpit from 'cockpit';
import { FileInfo } from 'cockpit/fsinfo.ts';
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
            ...clipboard.files.map(file => clipboard.path + "/" + file.name),
            dstPath
        ], { superuser: "try" });

        await cockpit.spawn([
            "chown",
            "--recursive",
            owner,
            ...clipboard.files.map(file => dstPath + "/" + file.name),
        ], { superuser: "try" });
    } catch (err) {
        const e = err as cockpit.BasicError;
        addAlert(e.message, AlertVariant.danger, `${new Date().getTime()}`);

        // cleanup potentially copied files in case of "chown" fail
        try {
            await cockpit.spawn([
                "rm",
                "-rf",
                ...clipboard.files.map(file => dstPath + "/" + file.name)
            ], { superuser: "try" });
        } catch (ex) {
            console.warn(`Failed to clean up copied files in ${dstPath}`, ex);
        }
    }
}

function makeCandidatesMap(currentUser: cockpit.UserInfo, cwdInfo: FileInfo, clipboard: ClipboardInfo) {
    const map: Record<string, string> = {};
    const candidates = get_owner_candidates(currentUser, cwdInfo);

    // also add current ownership if it is same for all files (shallow check)
    const firstFile = clipboard.files[0];
    const firstOwnerStr = `${firstFile.user}:${firstFile.group}`;
    if (clipboard.files.every(file => file.user === firstFile.user && file.group === firstFile.group)) {
        candidates.add(firstOwnerStr);
    }

    candidates.forEach(owner => {
        const split = owner.split(':');
        let key = owner;
        if (split.length === 2 && split[0] === split[1]) {
            key = split[0];
        }
        if (owner === firstOwnerStr) {
            key = `${key} ${_("(original owner)")}`;
        }

        map[key] = owner;
    });

    return map;
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

    let candidatesMap: Record<string, string> = {};
    if (superuser.allowed && currentUser && cwdInfo) {
        candidatesMap = makeCandidatesMap(currentUser, cwdInfo, clipboard);
        if (selectedOwner === undefined) {
            setSelectedOwner(Object.keys(candidatesMap)[0]);
        }
    }

    if (selectedOwner === undefined) {
        return;
    }

    const modalFooter = (
        <>
            <Button
              variant="primary"
              onClick={() => {
                  pasteAsOwner(clipboard, path, candidatesMap[selectedOwner], addAlert);
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
          title={_("Paste as owner")}
          isOpen
          onClose={() => dialogResult.resolve()}
          variant={ModalVariant.small}
          footer={modalFooter}
        >
            <Form isHorizontal>
                <TextContent>
                    <Text>
                        {_(`Files being pasted have a different owner. By default,
                            ownership will be changed to match the destination directory.`)}
                    </Text>
                </TextContent>
                <FormGroup fieldId="paste-as-owner" label={_("New owner")}>
                    <FormSelect
                      id='paste-owner-select'
                      value={selectedOwner}
                      onChange={(_ev, val) => setSelectedOwner(val)}
                    >
                        {Object.keys(candidatesMap).map(user =>
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
