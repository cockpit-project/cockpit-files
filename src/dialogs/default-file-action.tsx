/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2026 Red Hat, Inc.
 */

import React, { useState } from 'react';

import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import {
    Modal, ModalBody, ModalFooter, ModalHeader, ModalVariant
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { Radio } from '@patternfly/react-core/dist/esm/components/Radio';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { HelpIcon } from '@patternfly/react-icons';

import cockpit from 'cockpit';
import type { Dialogs, DialogResult } from 'dialogs';
import { fmt_to_fragments } from 'utils';

import type { FolderFileInfo } from '../common.ts';
import {
    DEFAULT_FILE_ACTIONS, actionName, type DefaultFileAction
} from '../default-file-action.ts';
import { downloadFile } from '../download.tsx';

import { edit_file, editor_supports } from './editor.tsx';

const _ = cockpit.gettext;

const ChooseActionModal = ({ dialogResult, firstRun, current } : {
    dialogResult: DialogResult<DefaultFileAction | null>,
    firstRun: boolean,
    current: DefaultFileAction | null,
}) => {
    const [choice, setChoice] = useState<DefaultFileAction | null>(current);

    const title = firstRun
        ? _("What should the default file action be?")
        : _("Default file action");

    return (
        <Modal
          id="default-file-action-modal"
          position="top"
          variant={ModalVariant.small}
          isOpen
          onClose={() => dialogResult.resolve(null)}
        >
            <ModalHeader title={title} />
            <ModalBody>
                <Stack hasGutter>
                    {firstRun &&
                    /* Translators: ⋮ is the vertical three-dot icon of the overflow menu */
                    <p>{_("This can be changed at any time in the ⋮ menu.")}</p>}
                    <Form>
                        <FormGroup
                          fieldId="default-file-action-group"
                          role="radiogroup"
                          label={<span className="pf-v6-screen-reader">{_("Default file action")}</span>}
                        >
                            {DEFAULT_FILE_ACTIONS.map(action =>
                                <Flex
                                  key={action} spaceItems={{ default: 'spaceItemsSm' }}
                                  alignItems={{ default: 'alignItemsCenter' }}
                                >
                                    <FlexItem spacer={{ default: 'spacerNone' }}>
                                        <Radio
                                          id={"default-file-action-" + action}
                                          name="default-file-action"
                                          isChecked={choice === action}
                                          onChange={() => setChoice(action)}
                                          label={actionName(action)}
                                        />
                                    </FlexItem>
                                    {action === "prefer-editor" &&
                                    <FlexItem spacer={{ default: 'spacerNone' }}>
                                        <Popover
                                          headerContent={actionName(action)}
                                          bodyContent={_("Open in the editor when possible, download otherwise.")}
                                          showClose={false}
                                        >
                                            <HelpIcon />
                                        </Popover>
                                    </FlexItem>}
                                </Flex>)}
                        </FormGroup>
                    </Form>
                </Stack>
            </ModalBody>
            <ModalFooter>
                <Button
                  id="default-file-action-confirm"
                  variant="primary"
                  isDisabled={choice === null}
                  onClick={() => dialogResult.resolve(choice)}
                >
                    {_("Save")}
                </Button>
                <Button variant="link" onClick={() => dialogResult.resolve(null)}>{_("Cancel")}</Button>
            </ModalFooter>
        </Modal>
    );
};

export function show_default_file_action_dialog(
    dialogs: Dialogs,
    current: DefaultFileAction | null,
): Promise<DefaultFileAction | null> {
    return dialogs.run(ChooseActionModal, { firstRun: current === null, current });
}

const AskActionModal = ({ dialogResult, file } : {
    dialogResult: DialogResult<"download" | "edit" | "settings" | null>,
    file: FolderFileInfo,
}) => {
    const boldName = <b className="ct-heading-font-weight">{file.name}</b>;

    return (
        <Modal
          id="default-file-ask-modal"
          position="top"
          variant={ModalVariant.small}
          isOpen
          onClose={() => dialogResult.resolve(null)}
        >
            <ModalHeader title={fmt_to_fragments(_("Choose action for $0"), boldName)} />
            <ModalBody>
                <Stack hasGutter>
                    <Button
                      id="ask-download-button"
                      variant="secondary"
                      isBlock
                      onClick={() => dialogResult.resolve("download")}
                    >
                        {_("Download")}
                    </Button>
                    <Button
                      id="ask-edit-button"
                      variant="secondary"
                      isBlock
                      onClick={() => dialogResult.resolve("edit")}
                    >
                        {_("Edit")}
                    </Button>
                    <Button
                      id="ask-settings-button"
                      variant="link"
                      isBlock
                      onClick={() => dialogResult.resolve("settings")}
                    >
                        {_("Change default…")}
                    </Button>
                </Stack>
            </ModalBody>
        </Modal>
    );
};

function editFileOrDownload(dialogs: Dialogs, path: string, file: FolderFileInfo): void {
    if (editor_supports(file)) {
        edit_file(dialogs, path + file.name);
    } else {
        downloadFile(path, file);
    }
}

async function runDefaultFileAction(
    action: DefaultFileAction,
    dialogs: Dialogs,
    path: string,
    file: FolderFileInfo,
    setAction: (action: DefaultFileAction) => void,
): Promise<void> {
    switch (action) {
    case "download":
        downloadFile(path, file);
        break;
    case "prefer-editor":
        editFileOrDownload(dialogs, path, file);
        break;
    case "ask": {
        // Refused files have nothing to choose: download directly instead of a
        // one-option modal (the ⋮ menu still offers reconfiguration)
        if (!editor_supports(file)) {
            downloadFile(path, file);
            break;
        }
        const choice = await dialogs.run(AskActionModal, { file });
        if (choice === "download") {
            downloadFile(path, file);
        } else if (choice === "edit") {
            editFileOrDownload(dialogs, path, file);
        } else if (choice === "settings") {
            const newAction = await show_default_file_action_dialog(dialogs, "ask");
            if (newAction !== null) {
                setAction(newAction);
                await runDefaultFileAction(newAction, dialogs, path, file, setAction);
            }
        }
        break;
    }
    }
}

// The folder view fires the double-click handler twice per gesture (once via
// click with detail > 1, once via the dblclick event); idempotent navigation
// tolerated it, downloads and dialogs must not be triggered twice. Tracked per
// file so a quick gesture on a different file is not swallowed.
let lastGesture: { key: string; time: number } = { key: "", time: 0 };
const COALESCE_MS = 300;

export async function handleFileDoubleClick(
    dialogs: Dialogs,
    path: string,
    file: FolderFileInfo,
    action: DefaultFileAction | null,
    setAction: (action: DefaultFileAction) => void,
): Promise<void> {
    const key = path + file.name;
    const now = Date.now();
    if (now - lastGesture.time < COALESCE_MS && lastGesture.key === key)
        return;
    lastGesture = { key, time: now };

    if (action !== null) {
        await runDefaultFileAction(action, dialogs, path, file, setAction);
        return;
    }

    // First run: choosing an action always persists it and applies to this very
    // file, so the double-click that triggered the dialog is never wasted.
    const choice = await show_default_file_action_dialog(dialogs, null);
    if (choice === null)
        return;
    setAction(choice);
    await runDefaultFileAction(choice, dialogs, path, file, setAction);
}
