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

import React, { useState } from 'react';

import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { Modal, ModalVariant } from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';

import cockpit from 'cockpit';
import { FormHelper } from 'cockpit-components-form-helper';
import { InlineNotification } from 'cockpit-components-inline-notification';
import type { Dialogs, DialogResult } from 'dialogs';
import { FileInfo } from 'fsinfo';
import { fmt_to_fragments } from 'utils';

import { FolderFileInfo, useFilesContext } from '../app';

const _ = cockpit.gettext;

function checkName(candidate: string, entries: Record<string, FileInfo>, selectedFile: FolderFileInfo) {
    if (candidate === "") {
        return _("Name cannot be empty.");
    } else if (candidate.length >= 256) {
        return _("Name too long.");
    } else if (candidate.includes("/")) {
        return _("Name cannot include a /.");
    } else if (selectedFile.name === candidate) {
        return _("Filename is the same as original name");
    } else if (candidate in entries) {
        if (entries[candidate].type === "dir") {
            return _("Directory with the same name exists");
        }
        return _("File exists");
    } else {
        return null;
    }
}

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
    path: string[],
    selected: FolderFileInfo,
}) => {
    const { cwdInfo } = useFilesContext();
    const [name, setName] = useState(selected.name);
    const [nameError, setNameError] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [overrideFileName, setOverrideFileName] = useState(false);

    const renameItem = (force = false) => {
        const newPath = path.join("/") + "/" + name;
        const mvCmd = ["mv", "--no-target-directory"];
        if (force) {
            mvCmd.push("--force");
        }
        mvCmd.push(path.join("/") + "/" + selected.name, newPath);

        cockpit.spawn(mvCmd, { superuser: "try", err: "message" })
                .then(() => {
                    dialogResult.resolve();
                }, err => setErrorMessage(err.message));
    };

    const footer = (
        <>
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
        </>
    );

    const label = selected.type !== "dir" ? _("New filename") : _("New name");

    return (
        <Modal
          position="top"
          // @ts-expect-error incorrect PatternFly typing https://github.com/patternfly/patternfly-react/issues/10361
          title={fmt_to_fragments(_("Rename $0?"), <b>{selected.name}</b>)}
          variant={ModalVariant.small}
          isOpen
          onClose={() => dialogResult.resolve()}
          footer={footer}
        >
            <Stack>
                {errorMessage !== undefined &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                  isLiveRegion={false} // HACK: temporary https://github.com/cockpit-project/cockpit/pull/20772
                />}
                <Form
                  isHorizontal onSubmit={e => {
                      e.preventDefault();
                      if (name !== selected.name)
                          renameItem();
                      else {
                          setNameError(checkName(name, cwdInfo?.entries || {}, selected));
                      }
                      return false;
                  }}
                >
                    <FormGroup fieldId="rename-item-input" label={label}>
                        <TextInput
                          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                          value={name}
                          onChange={(_, val) => {
                              setNameError(checkName(val, cwdInfo?.entries || {}, selected));
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
        </Modal>
    );
};

export function show_rename_dialog(dialogs: Dialogs, path: string[], selected: FolderFileInfo) {
    dialogs.run(RenameItemModal, { path, selected });
}
