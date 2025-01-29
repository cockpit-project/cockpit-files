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
import {
    DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm
} from "@patternfly/react-core/dist/esm/components/DescriptionList/index";
import { Modal, ModalVariant } from "@patternfly/react-core/dist/esm/components/Modal";
import { Text, TextContent, TextVariants } from "@patternfly/react-core/dist/esm/components/Text";
import { Flex, } from "@patternfly/react-core/dist/esm/layouts/Flex";

import cockpit from 'cockpit';
import { DialogResult, Dialogs } from 'dialogs';

const _ = cockpit.gettext;

const KeyboardShortcutsHelp = ({ dialogResult } : { dialogResult: DialogResult<void> }) => {
    const footer = (
        <Button variant="secondary" onClick={() => dialogResult.resolve()}>{_("Close")}</Button>
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
                <kbd className="key">Alt</kbd> + <kbd className="key">{'\u{2191}'}</kbd>
            </kbd>,
            _("Go up a directory"),
            "go-up",
        ], [
            <kbd className="keystroke" key="go-back">
                <kbd className="key">Alt</kbd> + <kbd className="key">{'\u{2190}'}</kbd>
            </kbd>,
            _("Go back"),
            "go-back",
        ], [
            <kbd className="keystroke" key="go-forward">
                <kbd className="key">Alt</kbd> + <kbd className="key">{'\u{2192}'}</kbd>
            </kbd>,
            _("Go forward"),
            "go-forward",
        ], [
            <kbd className="keystroke" key="activate">
                <kbd className="key">Alt</kbd> + <kbd className="key">{'\u{2193}'}</kbd>
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
                <kbd className="key">Ctrl</kbd> +
                <kbd className="key">Shift</kbd> +
                <kbd className="key">L</kbd>
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
                <kbd className="key">Ctrl</kbd> + <kbd className="key">C</kbd>
            </kbd>,
            _("Copy selected file or directory"),
            "copy",
        ], [
            <kbd className="keystroke" key="paste">
                <kbd className="key">Ctrl</kbd> + <kbd className="key">V</kbd>
            </kbd>,
            _("Paste file or directory"),
            "paste",
        ], [
            <kbd className="keystroke" key="select-all">
                <kbd className="key">Ctrl</kbd> + <kbd className="key">A</kbd>
            </kbd>,
            _("Select all"),
            "select-all",
        ]
    ];

    return (
        <Modal
          position="top"
          title={_("Keyboard shortcuts")}
          variant={ModalVariant.large}
          className="shortcuts-dialog"
          onClose={() => dialogResult.resolve()}
          footer={footer}
          isOpen
        >
            <Flex>
                <TextContent>
                    <Text component={TextVariants.h2}>{_("Navigation")}</Text>
                    <DescriptionList
                      isHorizontal
                      isFluid
                      isFillColumns
                    >
                        {navShortcuts.map(toDescriptionListGroups)}
                    </DescriptionList>
                </TextContent>
                <TextContent>
                    <Text component={TextVariants.h2}>{_("Editing")}</Text>
                    <DescriptionList
                      isHorizontal
                      isFluid
                      isFillColumns
                    >
                        {editShortcuts.map(toDescriptionListGroups)}
                    </DescriptionList>
                </TextContent>
            </Flex>
        </Modal>
    );
};

export function showKeyboardShortcuts(dialogs: Dialogs) {
    dialogs.run(KeyboardShortcutsHelp, {});
}
