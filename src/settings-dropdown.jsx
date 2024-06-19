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
import React, { useState } from "react";

import { Dropdown, DropdownItem, DropdownList } from "@patternfly/react-core/dist/esm/components/Dropdown";
import { Icon } from "@patternfly/react-core/dist/esm/components/Icon";
import { MenuToggle } from "@patternfly/react-core/dist/esm/components/MenuToggle";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { CheckIcon, EllipsisVIcon } from "@patternfly/react-icons";

import cockpit from "cockpit";

const _ = cockpit.gettext;

export const SettingsDropdown = ({ showHidden, setShowHidden }) => {
    const [isOpen, setIsOpen] = useState(false);
    const onToggleClick = () => setIsOpen(!isOpen);
    const onSelect = (_event, _itemId) => setIsOpen(false);

    const onToggleHidden = () => {
        setShowHidden(prevShowHidden => {
            localStorage.setItem("files:showHiddenFiles", !showHidden ? "true" : "false");
            return !prevShowHidden;
        });
    };

    const showHiddenItems = (
        <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
            <FlexItem>{_("Show hidden items")}</FlexItem>
            <FlexItem>
                {showHidden &&
                <Icon size="sm">
                    <CheckIcon className="check-icon" />
                </Icon>}
            </FlexItem>
        </Flex>
    );

    return (
        <Dropdown
          isOpen={isOpen}
          onSelect={onSelect}
          onOpenChange={setIsOpen}
          popperProps={{ position: "right" }}
          toggle={toggleRef =>
              <MenuToggle
                ref={toggleRef} variant="plain"
                onClick={onToggleClick} isExpanded={isOpen}
                id="global-settings-menu"
              >
                  <EllipsisVIcon />
              </MenuToggle>}
        >
            <DropdownList>
                <DropdownItem
                  id="show-hidden-items"
                  onClick={onToggleHidden}
                >
                    {showHiddenItems}
                </DropdownItem>
            </DropdownList>
        </Dropdown>
    );
};
