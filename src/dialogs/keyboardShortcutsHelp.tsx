import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm
} from "@patternfly/react-core/dist/esm/components/DescriptionList/index";
import { Modal, ModalVariant } from "@patternfly/react-core/dist/esm/components/Modal";
import { Text, TextContent, TextVariants } from "@patternfly/react-core/dist/esm/components/Text";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";

import cockpit from 'cockpit';
import { useDialogs } from 'dialogs';

const _ = cockpit.gettext;

export const KeyboardShortcutsHelp = () => {
    const Dialogs = useDialogs();

    const footer = (
        <Button variant="secondary" onClick={Dialogs.close}>{_("Close")}</Button>
    );

    const toDescriptionListItems = (item: [React.JSX.Element, string]) => {
        return (
            <>
                <DescriptionListTerm>{item[0]}</DescriptionListTerm>
                <DescriptionListDescription>{item[1]}</DescriptionListDescription>
            </>
        );
    };

    const navShortcuts: Array<[React.JSX.Element, string]> = [
        [
            <kbd className="keystroke" key="go-up">
                <kbd className="key">Alt</kbd> + <kbd className="key">{'\u{2191}'}</kbd>
            </kbd>,
            _("Go up a directory")
        ], [
            <kbd className="keystroke" key="go-back">
                <kbd className="key">Alt</kbd> + <kbd className="key">{'\u{2190}'}</kbd></kbd>,
            _("Go back")
        ], [
            <kbd className="keystroke" key="go-forward">
                <kbd className="key">Alt</kbd> + <kbd className="key">{'\u{2192}'}</kbd></kbd>,
            _("Go forward")
        ], [
            <kbd className="keystroke" key="activate">
                <kbd className="key">Alt</kbd> + <kbd className="key">{'\u{2193}'}</kbd></kbd>,
            _("Activate selected item, enter directory")
        ], [
            <kbd className="keystroke" key="activate-enter">
                <kbd className="key">Enter</kbd></kbd>, _("Activate selected item, enter directory")
        ], [
            <kbd className="keystroke" key="edit-path">
                <kbd className="key">Ctrl</kbd> +
                <kbd className="key">Shift</kbd> +
                <kbd className="key">L</kbd>
            </kbd>,
            _("Edit path")
        ]
    ];

    const editShortcuts: Array<[React.JSX.Element, string]> = [
        [
            <kbd className="key" key="rename">F2</kbd>,
            _("Rename selected file or directory")
        ], [
            <kbd className="key" key="mkdir">N</kbd>,
            _("Create new directory")
        ], [
            <kbd className="keystroke" key="copy">
                <kbd className="key">Ctrl</kbd> + <kbd className="key">C</kbd>
            </kbd>,
            _("Copy selected file or directory")
        ], [
            <kbd className="keystroke" key="cut">
                <kbd className="key">Ctrl</kbd> + <kbd className="key">X</kbd>
            </kbd>,
            _("Cut selected file or directory")
        ], [
            <kbd className="keystroke" key="paste">
                <kbd className="key">Ctrl</kbd> + <kbd className="key">V</kbd>
            </kbd>,
            _("Paste file or directory")
        ], [
            <kbd className="keystroke" key="select-all">
                <kbd className="key">Ctrl</kbd> + <kbd className="key">A</kbd>
            </kbd>,
            _("Select all")
        ]
    ];

    return (
        <Modal
          position="top"
          title={_("Keyboard shortcuts")}
          variant={ModalVariant.medium}
          className="shortcuts-dialog"
          onClose={Dialogs.close}
          footer={footer}
          isOpen
        >
            <Flex>
                <TextContent>
                    <Text component={TextVariants.h2}>{_("Navigation")}</Text>
                    <DescriptionList isHorizontal isFluid isFillColumns >
                        <DescriptionListGroup>{navShortcuts.map(toDescriptionListItems)}</DescriptionListGroup>
                    </DescriptionList>
                </TextContent>
                <TextContent>
                    <Text component={TextVariants.h2}>{_("Editing")}</Text>
                    <DescriptionList isHorizontal isFluid isFillColumns >
                        <DescriptionListGroup>{editShortcuts.map(toDescriptionListItems)}</DescriptionListGroup>
                    </DescriptionList>
                </TextContent>
            </Flex>
        </Modal>
    );
};
