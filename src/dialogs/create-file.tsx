/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2024 Red Hat, Inc.
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

import React from 'react';

import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import {
    Modal, ModalBody, ModalFooter, ModalHeader, ModalVariant
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea';
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';

import cockpit from 'cockpit';
import { FormHelper } from 'cockpit-components-form-helper';
import type { Dialogs, DialogResult } from 'dialogs';
import { useInit } from 'hooks';
import { superuser } from 'superuser';

import "./editor.css";
import { checkFilename, useFilesContext } from '../common.ts';
import { get_owner_candidates } from '../ownership.tsx';

const _ = cockpit.gettext;

async function create_file(filename: string, content?: string, owner?: string | null) {
    const file = cockpit.file(filename, { superuser: "try" });

    try {
        await file.replace("");
    } catch (err) {
        console.warn("Cannot create new file", err);
        throw err;
    }

    if (owner) {
        try {
            await cockpit.spawn(["chown", owner, filename], { superuser: "require" });
        } catch (err) {
            console.warn("Cannot chown new file", err);
            try {
                await cockpit.spawn(["rm", filename], { superuser: "require" });
            } catch (err) {
                console.warn(`Failed to cleanup ${filename}`, err);
            }
            throw err;
        }
    }

    if (content) {
        // We need to obtain the tag to retain file ownership
        // Can't do this async because we can't get the tag via await
        await cockpit.file(filename, { superuser: "try" }).read()
                .then(((async (_content: string, tag: string) => {
                    try {
                        await cockpit.file(filename, { superuser: "try" }).replace(content, tag);
                    } catch (err) {
                        console.warn("Cannot set initial file text", err);
                        try {
                            await cockpit.spawn(["rm", filename], { superuser: "require" });
                        } catch (err) {
                            console.warn(`Failed to cleanup ${filename}`, err);
                        }
                        throw err;
                    }
                }) as any /* eslint-disable-line @typescript-eslint/no-explicit-any */));
    }
}

const CreateFileModal = ({ dialogResult, path } : {
    dialogResult: DialogResult<string | null>,
    path: string
}) => {
    const [filename, setFilename] = React.useState<string>("");
    const [owner, setOwner] = React.useState<string | null>(null);
    const [initialText, setInitialText] = React.useState<string>("");
    const [filenameError, setFileNameError] = React.useState<string | null>(null);
    const [createError, setCreateError] = React.useState<string | null>(null);
    const [candidates, setCandidates] = React.useState<string[]>([]);

    const { cwdInfo } = useFilesContext();

    useInit(() => {
        const owner_candidates = [];
        if (superuser.allowed && cwdInfo) {
            owner_candidates.push(...get_owner_candidates(cwdInfo));
            setOwner(owner_candidates[0]);
            setCandidates(owner_candidates);
        }
    });

    const handleEscape = (event: KeyboardEvent) => {
        if (filename !== "" || initialText !== "") {
            event.preventDefault();
        } else {
            dialogResult.resolve(null);
        }
    };

    const handleSave = async () => {
        cockpit.assert(filename, "filename undefined");
        const filename_valid = checkFilename(filename, cwdInfo?.entries || {}, undefined);
        if (filename_valid !== null) {
            setFileNameError(filename_valid);
            return;
        }

        const full_path = path + filename;
        try {
            await create_file(full_path, initialText, owner);
        } catch (err) {
            const exc = err as cockpit.BasicError; // HACK: You can't easily type an error in typescript
            setCreateError(exc.message);
            return;
        }

        dialogResult.resolve(full_path);
    };

    if (superuser.allowed && owner === undefined)
        return null;

    return (
        <Modal
          position="top"
          isOpen
          onClose={() => dialogResult.resolve(null)}
          variant={ModalVariant.large}
          className="file-create-modal"
          onEscapePress={handleEscape}
        >
            <ModalHeader title={_("Create file")} />
            <ModalBody>
                <Stack>
                    {createError &&
                    <Alert
                      className="file-editor-alert"
                      variant="danger"
                      title={createError}
                      isInline
                    />}
                    <Form isHorizontal>
                        <FormGroup
                          label={_("File name")}
                          fieldId="file-name"
                        >
                            <TextInput
                              autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                              id="file-name"
                              isRequired
                              value={filename}
                              onChange={(_event, value) => {
                                  setFileNameError(checkFilename(value, cwdInfo?.entries || {}, undefined));
                                  setFilename(value);
                              }}
                            />
                            <FormHelper fieldId="file-name" helperTextInvalid={filenameError} />
                        </FormGroup>
                        <TextArea
                          id="editor-text-area"
                          className="file-editor"
                          value={initialText}
                          onChange={(_ev, content) => setInitialText(content)}
                        />
                        {candidates.length > 0 &&
                            <FormGroup fieldId="create-file-owner" label={_("Owner")}>
                                <FormSelect
                                  id="create-file-owner"
                                  value={owner}
                                  onChange={(_ev, val) => setOwner(val)}
                                >
                                    {candidates.map(owner =>
                                        <FormSelectOption
                                          key={owner}
                                          value={owner}
                                          label={owner}
                                        />)}
                                </FormSelect>
                            </FormGroup>}
                    </Form>
                </Stack>
            </ModalBody>
            <ModalFooter>
                <Button
                  variant="primary"
                  isDisabled={!filename || initialText === null || filenameError !== null}
                  onClick={handleSave}
                >
                    {_("Create")}
                </Button>
                <Button variant="link" onClick={() => dialogResult.resolve(null)}>
                    {_("Cancel")}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export async function show_create_file_dialog(
    dialogs: Dialogs,
    path: string,
    addAlert: (title: string, variant: AlertVariant, key: string, detail?: string) => void
) {
    if (!superuser.allowed) {
        try {
            await cockpit.spawn(["test", "-w", path]);
        } catch {
            addAlert(_("Cannot create file in current directory"), AlertVariant.warning, "create-file",
                     _("Permission denied"));
            return;
        }
    }

    await dialogs.run(CreateFileModal, { path });
}
