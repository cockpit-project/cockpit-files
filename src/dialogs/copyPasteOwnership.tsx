/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Copyright (C) 2024 Red Hat, Inc.
 */

import React, { useState } from 'react';

import { AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Content, } from "@patternfly/react-core/dist/esm/components/Content";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import {
    Modal, ModalBody, ModalFooter, ModalHeader, ModalVariant
} from '@patternfly/react-core/dist/esm/components/Modal';

import cockpit from 'cockpit';
import { type FileInfo } from 'cockpit/fsinfo.ts';
import type { Dialogs, DialogResult } from 'dialogs';
import { useEvent, useInit } from 'hooks.ts';
import { superuser } from 'superuser';

import { useFilesContext } from '../common.ts';
import type { AlertInfo, ClipboardInfo, FolderFileInfo } from '../common.ts';
import { get_owner_candidates } from '../ownership.tsx';

const _ = cockpit.gettext;

async function pasteAsOwner(clipboard: ClipboardInfo,
    dstPath: string,
    ownerStr: string,
    addAlert: (alert: AlertInfo) => void) {
    try {
        await cockpit.spawn([
            "cp",
            "--archive",
            ...clipboard.files.map(file => clipboard.path + "/" + file.name),
            dstPath
        ], { superuser: "require" });

        // "original" is a special value, valid values are formatted as 'user:group'
        if (ownerStr !== "original") {
            await cockpit.spawn([
                "chown",
                "--recursive",
                ownerStr,
                ...clipboard.files.map(file => dstPath + "/" + file.name),
            ], { superuser: "require" });
        }
    } catch (err) {
        const e = err as cockpit.BasicError;
        addAlert({ title: _("Pasting failed"), variant: AlertVariant.danger, detail: e.message });

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

function ownershipTypes(files: FolderFileInfo[]) {
    const owners = new Set();

    for (const file of files) {
        const user = file.user;
        const group = file.group;

        if (user === group) {
            owners.add(String(user));
        } else {
            owners.add(`${user}:${group}`);
        }
    }

    return [...owners];
}

function makeCandidatesMap(cwdInfo: FileInfo, clipboard: ClipboardInfo) {
    // keys in Map() are ordered in the same order as they were inserted
    // and has no duplicates. Only the first insertion.
    const map: Map<string, string> = new Map();
    const candidates = get_owner_candidates(cwdInfo);

    // also add current ownership if it is same for all files (shallow check)
    const firstFile = clipboard.files[0];
    const firstOwnerStr = `${firstFile.user}:${firstFile.group}`;
    const uniqueOwners = ownershipTypes(clipboard.files);
    if (uniqueOwners.length === 1) {
        candidates.add(firstOwnerStr);
    }

    candidates.forEach(owner => {
        const split = owner.split(':');
        let key = owner;
        if (split.length === 2 && split[0] === split[1]) {
            key = split[0];
        }
        if (uniqueOwners.length === 1 && owner === firstOwnerStr) {
            key = `${key} ${_("(original owner)")}`;
        }

        map.set(key, owner);
    });

    // add option to keep the same permissions on mixed permissions files
    if (uniqueOwners.length > 1) {
        const dots = uniqueOwners.length > 2 ? ", ..." : "";
        map.set(`${_("keep original owners")} (${uniqueOwners.slice(0, 2).join(", ")}${dots})`, "original");
    }

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
    useEvent(superuser, "changed");
    const [selectedOwner, setSelectedOwner] = useState<string | undefined>();
    const { cwdInfo, addAlert } = useFilesContext();
    const [candidatesMap, setCandidatesMap] = useState<Map<string, string> | undefined>();

    useInit(async () => {
        let map: Map<string, string> = new Map();

        if (superuser.allowed && cwdInfo) {
            map = makeCandidatesMap(cwdInfo, clipboard);
            if (selectedOwner === undefined) {
                setSelectedOwner(map.keys().next().value);
            }
        }

        setCandidatesMap(map);
    });

    if (selectedOwner === undefined || candidatesMap === undefined) {
        return;
    }

    const selectedVal = candidatesMap.get(selectedOwner);
    cockpit.assert(selectedVal !== undefined, "New file ownership undefined");

    const modalFooter = (
        <ModalFooter>
            <Button
              variant="primary"
              onClick={() => {
                  pasteAsOwner(clipboard, path, selectedVal, addAlert);
                  dialogResult.resolve();
              }}
            >
                {_("Paste")}
            </Button>
            <Button variant="link" onClick={() => dialogResult.resolve()}>{_("Cancel")}</Button>
        </ModalFooter>
    );

    return (
        <Modal
          id="paste-owner-modal"
          position="top"
          isOpen
          onClose={() => dialogResult.resolve()}
          variant={ModalVariant.small}
        >
            <ModalHeader title={_("Paste as owner")} />
            <ModalBody>
                <Form isHorizontal>
                    <Content>
                        <Content component="p">
                            {/*eslint-disable-line*/ _("Files being pasted have a different owner. By default, ownership will be changed to match the destination directory.")}
                        </Content>
                    </Content>
                    <FormGroup fieldId="paste-as-owner" label={_("New owner")}>
                        <FormSelect
                          id='paste-owner-select'
                          value={selectedOwner}
                          onChange={(_ev, val) => setSelectedOwner(val)}
                        >
                            {[...candidatesMap.keys()].map(user =>
                                <FormSelectOption
                                  key={user}
                                  value={user}
                                  label={user}
                                />)}
                        </FormSelect>
                    </FormGroup>
                </Form>
            </ModalBody>
            {modalFooter}
        </Modal>
    );
};

export function show_copy_paste_as_owner(dialogs: Dialogs, clipboard: ClipboardInfo, path: string) {
    dialogs.run(CopyPasteAsOwnerModal, { clipboard, path });
}
