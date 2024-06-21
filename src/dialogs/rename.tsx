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

import { FolderFileInfo, useFilesContext } from '../app';

const _ = cockpit.gettext;

function check_name(candidate: string, entries: Record<string, unknown>) {
    if (candidate === "") {
        return _("Name cannot be empty.");
    } else if (candidate.length >= 256) {
        return _("Name too long.");
    } else if (candidate.includes("/")) {
        return _("Name cannot include a /.");
    } else if (candidate in entries) {
        return _("File or directory already exists");
    } else {
        return null;
    }
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
        const newPath = path.join("/") + "/" + name;

        cockpit.spawn(["mv", "--no-target-directory", path.join("/") + "/" + selected.name, newPath],
                      { superuser: "try", err: "message" })
                .then(() => {
                    dialogResult.resolve();
                }, err => setErrorMessage(err.message));
    };

    return (
        <Modal
          position="top"
          title={title}
          variant={ModalVariant.small}
          isOpen
          onClose={() => dialogResult.resolve()}
          footer={
              <>
                  <Button
                    variant="primary"
                    onClick={renameItem}
                    isDisabled={errorMessage !== undefined || nameError !== null}
                  >
                      {_("Rename")}
                  </Button>
                  <Button variant="link" onClick={() => dialogResult.resolve()}>{_("Cancel")}</Button>
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
                          onChange={(_, val) => {
                              setNameError(check_name(val, cwdInfo?.entries || {}));
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
