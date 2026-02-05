/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2017 Red Hat, Inc.
 */

import React, { useState } from 'react';

import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import {
    Modal, ModalBody, ModalFooter, ModalHeader, ModalVariant
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';

import cockpit from 'cockpit';
import type { FileInfo } from "cockpit/fsinfo.ts";
import { FormHelper } from 'cockpit-components-form-helper';
import { InlineNotification } from 'cockpit-components-inline-notification';
import type { Dialogs, DialogResult } from 'dialogs';
import { fmt_to_fragments } from 'utils';

import { checkFilename, useFilesContext } from '../common.ts';
import type { FolderFileInfo } from '../common.ts';

const _ = cockpit.gettext;

function checkCanOverride(candidate: string, entries: Record<string, FileInfo>, selectedFile: FolderFileInfo) {
    if (candidate in entries) {
        const conflictFile = entries[candidate];
        // only allow overwriting regular files
        if (conflictFile.type !== "reg") {
            return false;
        }

        // don't allow overwrite when the filename is unchanged
        if (selectedFile.type === "reg" && candidate !== selectedFile.name) {
            return true;
        }
    }

    return false;
}

const RenameItemModal = ({ dialogResult, path, selected } : {
    dialogResult: DialogResult<void>
    path: string,
    selected: FolderFileInfo,
}) => {
    const { cwdInfo } = useFilesContext();
    const [name, setName] = useState(selected.name);
    const [nameError, setNameError] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [overrideFileName, setOverrideFileName] = useState(false);

    const renameItem = (force = false) => {
        const newPath = path + name;
        const mvCmd = ["mv", "--no-target-directory"];
        if (force) {
            mvCmd.push("--force");
        }
        mvCmd.push(path + selected.name, newPath);

        cockpit.spawn(mvCmd, { superuser: "try", err: "message" })
                .then(() => {
                    dialogResult.resolve();
                }, err => setErrorMessage(err.message));
    };

    const footer = (
        <ModalFooter>
            <Button
              variant="primary"
              onClick={() => renameItem()}
              isDisabled={errorMessage !== undefined || nameError !== null}
            >
                {_("Rename")}
            </Button>
            {overrideFileName &&
                <Button
                  variant="danger"
                  onClick={() => renameItem(true)}
                >
                    {_("Overwrite")}
                </Button>}
            <Button variant="link" onClick={() => dialogResult.resolve()}>{_("Cancel")}</Button>
        </ModalFooter>
    );

    const label = selected.type !== "dir" ? _("New filename") : _("New name");

    return (
        <Modal
          position="top"
          variant={ModalVariant.small}
          isOpen
          onClose={() => dialogResult.resolve()}
        >
            <ModalHeader
              title={fmt_to_fragments(_("Rename $0?"), <b className="ct-heading-font-weight">{selected.name}</b>)}
            />
            <ModalBody>
                <Stack>
                    {errorMessage !== undefined &&
                    <InlineNotification
                      type="danger"
                      text={errorMessage}
                      isInline
                    />}
                    <Form
                      isHorizontal onSubmit={e => {
                          e.preventDefault();
                          if (name !== selected.name)
                              renameItem();
                          else {
                              setNameError(checkFilename(name, cwdInfo?.entries || {}, selected));
                          }
                          return false;
                      }}
                    >
                        <FormGroup fieldId="rename-item-input" label={label}>
                            <TextInput
                              autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                              value={name}
                              onChange={(_, val) => {
                                  setNameError(checkFilename(val, cwdInfo?.entries || {}, selected));
                                  setOverrideFileName(checkCanOverride(val, cwdInfo?.entries || {}, selected));
                                  setErrorMessage(undefined);
                                  setName(val);
                              }}
                              id="rename-item-input"
                            />
                            <FormHelper fieldId="rename-item-input" helperTextInvalid={nameError} />
                        </FormGroup>
                    </Form>
                </Stack>
            </ModalBody>
            {footer}
        </Modal>
    );
};

export function show_rename_dialog(dialogs: Dialogs, path: string, selected: FolderFileInfo) {
    dialogs.run(RenameItemModal, { path, selected });
}
