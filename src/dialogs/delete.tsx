/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2017 Red Hat, Inc.
 */

import React, { useState } from 'react';

import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
    Modal, ModalBody, ModalFooter, ModalHeader, ModalVariant
} from '@patternfly/react-core/dist/esm/components/Modal';

import cockpit from 'cockpit';
import { InlineNotification } from 'cockpit-components-inline-notification';
import type { Dialogs, DialogResult } from 'dialogs';
import { fmt_to_fragments } from 'utils';

import type { FolderFileInfo } from '../common.ts';

const _ = cockpit.gettext;

const ConfirmDeletionDialog = ({ dialogResult, path, selected, setSelected } : {
    dialogResult: DialogResult<void>
    path: string,
    selected: FolderFileInfo[], setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>,
}) => {
    const [errorMessage, setErrorMessage] = useState(null);
    const [forceDelete, setForceDelete] = useState(false);

    let modalTitle;
    if (selected.length > 1) {
        const selectedJSX = <b className="ct-heading-font-weight">{selected.length}</b>;
        modalTitle = fmt_to_fragments(forceDelete ? _("Force delete $0 items") : _("Delete $0 items?"), selectedJSX);
    } else {
        const selectedItem = selected[0];
        const selectedJSX = <b className="ct-heading-font-weight">{selectedItem.name}</b>;
        if (selectedItem.type === "reg") {
            modalTitle = fmt_to_fragments(
                forceDelete ? _("Force delete file $0?") : _("Delete file $0?"), selectedJSX
            );
        } else if (selectedItem.type === "lnk") {
            modalTitle = fmt_to_fragments(
                forceDelete ? _("Force delete link $0?") : _("Delete link $0?"), selectedJSX
            );
        } else if (selectedItem.type === "dir") {
            modalTitle = fmt_to_fragments(
                forceDelete ? _("Force delete directory $0?") : _("Delete directory $0?"), selectedJSX
            );
        } else {
            modalTitle = fmt_to_fragments(forceDelete ? _("Force delete $0") : _("Delete $0?"), selectedJSX);
        }
    }

    const deleteItem = () => {
        const args = ["rm", "-r"];
        // TODO: Make force more sensible https://github.com/cockpit-project/cockpit-files/issues/363
        cockpit.spawn([...args, ...selected.map(f => path + f.name)], { err: "message", superuser: "try" })
                .then(() => {
                    setSelected([]);
                    dialogResult.resolve();
                })
                .catch(err => {
                    setErrorMessage(err.message);
                    setForceDelete(true);
                });
    };

    return (
        <Modal
          position="top"
          variant={ModalVariant.medium}
          isOpen
          onClose={() => dialogResult.resolve()}
          elementToFocus="#delete-button"
        >
            <ModalHeader
              title={modalTitle}
              titleIconVariant="warning"
            />
            <ModalBody>
                {errorMessage &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                />}
            </ModalBody>
            <ModalFooter>
                <Button
                  id="delete-button"
                  variant="danger"
                  onClick={deleteItem}
                >
                    {_("Delete")}
                </Button>
                <Button variant="link" onClick={() => dialogResult.resolve()}>{_("Cancel")}</Button>
            </ModalFooter>
        </Modal>
    );
};

export function confirm_delete(
    dialogs: Dialogs,
    path: string,
    selected: FolderFileInfo[],
    setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>
) {
    dialogs.run(ConfirmDeletionDialog, { path, selected, setSelected });
}
