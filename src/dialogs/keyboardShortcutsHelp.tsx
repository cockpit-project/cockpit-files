import React from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm
} from "@patternfly/react-core/dist/esm/components/DescriptionList/index";
import { Modal, ModalVariant } from "@patternfly/react-core/dist/esm/components/Modal";
import { Text } from "@patternfly/react-core/dist/esm/components/Text";

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
        [<kbd key="go-up"><kbd>Alt</kbd> + <kbd>{'\u{2191}'}</kbd></kbd>, _("Go up a directory")],
        [<kbd key="go-back"><kbd>Alt</kbd> + <kbd>{'\u{2190}'}</kbd></kbd>, _("Go back")],
        [<kbd key="go-forward"><kbd>Alt</kbd> + <kbd>{'\u{2192}'}</kbd></kbd>, _("Go forward")],
        [
            <kbd key="activate"><kbd>Alt</kbd> + <kbd>{'\u{2193}'}</kbd></kbd>,
            _("Activate selected item, enter directory")
        ],
        [<kbd key="activate-enter"><kbd>Enter</kbd></kbd>, _("Activate selected item, enter directory")],
        [<kbd key="edit-path"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd></kbd>, _("Edit path")]
    ];

    const editShortcuts: Array<[React.JSX.Element, string]> = [
        [<kbd key="rename">F2</kbd>, _("Rename selected file or directory")],
        [<kbd key="mkdir">N</kbd>, _("Create new directory")],
        [<kbd key="copy"><kbd>Ctrl</kbd> + <kbd>C</kbd></kbd>, _("Copy selected file or directory")],
        [<kbd key="cut"><kbd>Ctrl</kbd> + <kbd>X</kbd></kbd>, _("Cut selected file or directory")],
        [<kbd key="paste"><kbd>Ctrl</kbd> + <kbd>V</kbd></kbd>, _("Paste file or directory")],
        [<kbd key="select-all"><kbd>Ctrl</kbd> + <kbd>A</kbd></kbd>, _("Select all")],
    ];

    return (
        <Modal
          position="top"
          title={_("Keyboard shortcuts")}
          variant={ModalVariant.medium}
          onClose={Dialogs.close}
          footer={footer}
          isOpen
        >
            <DescriptionList
              isHorizontal
              isFluid
              isFillColumns
              columnModifier={{ default: '2Col' }}
            >
                <Text>{_("Navigation")}</Text>
                <DescriptionListGroup>{navShortcuts.map(toDescriptionListItems)}</DescriptionListGroup>
                <Text>{_("Editing")}</Text>
                <DescriptionListGroup>{editShortcuts.map(toDescriptionListItems)}</DescriptionListGroup>
            </DescriptionList>
        </Modal>
    );
};
