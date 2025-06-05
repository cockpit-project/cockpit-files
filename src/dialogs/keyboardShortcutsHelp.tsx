/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2025 Red Hat, Inc.
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

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Content, ContentVariants } from "@patternfly/react-core/dist/esm/components/Content";
import {
    DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm
} from "@patternfly/react-core/dist/esm/components/DescriptionList/index";
import {
    Modal, ModalBody, ModalFooter, ModalHeader, ModalVariant
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Flex, } from "@patternfly/react-core/dist/esm/layouts/Flex";

import cockpit from 'cockpit';
import type { DialogResult, Dialogs } from 'dialogs';

import { testIsAppleDevice } from '../common.ts';

const _ = cockpit.gettext;

const KeyboardShortcutsHelp = ({ dialogResult } : { dialogResult: DialogResult<void> }) => {
    const isApple = testIsAppleDevice();
    const ctrlString = isApple ? "Command" : "Ctrl";
    const altString = isApple ? "Command" : "Alt";

    const footer = (
        <ModalFooter>
            <Button variant="secondary" onClick={() => dialogResult.resolve()}>{_("Close")}</Button>
        </ModalFooter>
    );

    const toDescriptionListGroups = (item: [React.JSX.Element, string, string]) => {
        return (
            <DescriptionListGroup key={item[2] + "-listgroup"}>
                <DescriptionListTerm>
                    {item[0]}
                </DescriptionListTerm>
                <DescriptionListDescription>
                    {item[1]}
                </DescriptionListDescription>
            </DescriptionListGroup>
        );
    };

    const navShortcuts: Array<[React.JSX.Element, string, string]> = [
        [
            <kbd className="keystroke" key="go-up">
                <kbd className="key">{altString}</kbd> + <kbd className="key">{'\u{2191}'}</kbd>
            </kbd>,
            _("Go up a directory"),
            "go-up",
        ], [
            <kbd className="keystroke" key="go-back">
                <kbd className="key">{altString}</kbd> + <kbd className="key">{'\u{2190}'}</kbd>
            </kbd>,
            _("Go back"),
            "go-back",
        ], [
            <kbd className="keystroke" key="go-forward">
                <kbd className="key">{altString}</kbd> + <kbd className="key">{'\u{2192}'}</kbd>
            </kbd>,
            _("Go forward"),
            "go-forward",
        ], [
            <kbd className="keystroke" key="activate">
                <kbd className="key">{altString}</kbd> + <kbd className="key">{'\u{2193}'}</kbd>
            </kbd>,
            _("Activate selected item, enter directory"),
            "activate",
        ], [
            <kbd className="keystroke" key="activate-enter">
                <kbd className="key">Enter</kbd>
            </kbd>,
            _("Activate selected item, enter directory"),
            "activate-enter",
        ], [
            <kbd className="keystroke" key="edit-path">
                <kbd className="key">{ctrlString}</kbd> +
                <kbd className="key">Shift</kbd> +
                <kbd className="key">{isApple ? "J" : "L"}</kbd>
            </kbd>,
            _("Edit path"),
            "edit-path",
        ]
    ];

    const editShortcuts: Array<[React.JSX.Element, string, string]> = [
        [
            <kbd className="key" key="rename">F2</kbd>,
            _("Rename selected file or directory"),
            "rename",
        ], [
            <kbd className="keystroke" key="create-dir">
                <kbd className="key">Shift</kbd> +
                <kbd className="key" key="mkdir">N</kbd>
            </kbd>,
            _("Create new directory"),
            "mkdir",
        ], [
            <kbd className="keystroke" key="copy">
                <kbd className="key">{ctrlString}</kbd> + <kbd className="key">C</kbd>
            </kbd>,
            _("Copy selected file or directory"),
            "copy",
        ], [
            <kbd className="keystroke" key="paste">
                <kbd className="key">{ctrlString}</kbd> + <kbd className="key">V</kbd>
            </kbd>,
            _("Paste file or directory"),
            "paste",
        ], [
            <kbd className="keystroke" key="select-all">
                <kbd className="key">{ctrlString}</kbd> + <kbd className="key">A</kbd>
            </kbd>,
            _("Select all"),
            "select-all",
        ]
    ];

    return (
        <Modal
          position="top"
          variant={ModalVariant.large}
          className="shortcuts-dialog"
          onClose={() => dialogResult.resolve()}
          isOpen
        >
            <ModalHeader title={_("Keyboard shortcuts")} />
            <ModalBody>
                <Flex>
                    <Content>
                        <Content component={ContentVariants.h2}>{_("Navigation")}</Content>
                        <DescriptionList
                          isHorizontal
                          isFluid
                          isFillColumns
                        >
                            {navShortcuts.map(toDescriptionListGroups)}
                        </DescriptionList>
                    </Content>
                    <Content>
                        <Content component={ContentVariants.h2}>{_("Editing")}</Content>
                        <DescriptionList
                          isHorizontal
                          isFluid
                          isFillColumns
                        >
                            {editShortcuts.map(toDescriptionListGroups)}
                        </DescriptionList>
                    </Content>
                </Flex>
            </ModalBody>
            {footer}
        </Modal>
    );
};

export function showKeyboardShortcuts(dialogs: Dialogs) {
    dialogs.run(KeyboardShortcutsHelp, {});
}
