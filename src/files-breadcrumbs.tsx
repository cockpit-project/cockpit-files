/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2023 Red Hat, Inc.
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
import React from "react";

import { AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { Dropdown, DropdownItem, DropdownList } from "@patternfly/react-core/dist/esm/components/Dropdown";
import { Icon } from "@patternfly/react-core/dist/esm/components/Icon";
import { MenuToggle, MenuToggleElement } from "@patternfly/react-core/dist/esm/components/MenuToggle";
import { PageBreadcrumb } from "@patternfly/react-core/dist/esm/components/Page";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Tooltip, TooltipPosition } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { CheckIcon, OutlinedHddIcon, PencilAltIcon, StarIcon, TimesIcon } from "@patternfly/react-icons";
import { useInit } from "hooks.js";

import cockpit from "cockpit";
import { KebabDropdown } from "cockpit-components-dropdown";

import { useFilesContext } from "./app";
import { basename } from "./common";

const _ = cockpit.gettext;

function BookmarkButton({ path }: { path: string[] }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [user, setUser] = React.useState<cockpit.UserInfo | null>(null);
    const [bookmarks, setBookmarks] = React.useState<string[]>([]);
    const [bookmarkHandle, setBookmarkHandle] = React.useState<cockpit.FileHandle<string> | null>(null);

    const { addAlert, cwdInfo } = useFilesContext();

    const currentPath = path.join("/") || "/";
    const defaultBookmarks = [];
    if (user?.home)
        defaultBookmarks.push({ name: _("Home"), loc: user?.home }); // TODO: add trash

    const parse_uri = (line: string) => {
        // Drop everything after the space, we don't show renames
        line = line.replace(/\s.*/, '');

        // Drop the file:/// prefix
        line = line.replace('file://', '');

        // Nautilus decodes urls as paths can contain spaces
        return line.split('/').map(part => decodeURIComponent(part))
                .join('/');
    };

    useInit(async () => {
        const user_info = await cockpit.user();
        setUser(user_info);

        const handle = cockpit.file(`${user_info.home}/.config/gtk-3.0/bookmarks`);
        setBookmarkHandle(handle);

        handle.watch((content) => {
            if (content !== null) {
                setBookmarks(content.trim().split("\n")
                        .filter(line => line.startsWith("file://"))
                        .map(parse_uri));
            } else {
                setBookmarks([]);
            }
        });

        return [handle];
    });

    const saveBookmark = async () => {
        cockpit.assert(user !== null, "user is null while saving bookmarks");
        cockpit.assert(bookmarkHandle !== null, "bookmarkHandle is null while saving bookmarks");
        const bookmark_file = basename(bookmarkHandle.path);
        const config_dir = bookmarkHandle.path.replace(bookmark_file, "");

        try {
            await cockpit.spawn(["mkdir", "-p", config_dir]);
        } catch (err) {
            const exc = err as cockpit.BasicError; // HACK: You can't easily type an error in typescript
            addAlert(_("Unable to create bookmark directory"), AlertVariant.danger, "bookmark-error",
                     exc.message);
            return;
        }

        try {
            await bookmarkHandle.modify((old_content: string) => {
                if (bookmarks.includes(currentPath)) {
                    return old_content.split('\n').filter(line => parse_uri(line) !== currentPath)
                            .join('\n');
                } else {
                    const newBoomark = "file://" + path.map(part => encodeURIComponent(part))
                            .join('/') + "\n";
                    return (old_content || '') + newBoomark;
                }
            });
        } catch (err) {
            const exc = err as cockpit.BasicError; // HACK: You can't easily type an error in typescript
            addAlert(_("Unable to save bookmark file"), AlertVariant.danger, "bookmark-error",
                     exc.message);
        }
    };

    const handleSelect = (_event: React.MouseEvent<Element, MouseEvent> | undefined,
        value: string| number | undefined) => {
        if (value === "bookmark-action") {
            saveBookmark();
        } else {
            cockpit.location.go("/", { path: encodeURIComponent((value as string)) });
        }
        setIsOpen(false);
    };

    if (user === null)
        return null;

    let actionText = null;
    if (currentPath !== user.home) {
        if (bookmarks.includes(currentPath)) {
            actionText = _("Remove current directory");
        } else if (cwdInfo !== null) {
            actionText = _("Add bookmark");
        }
    }

    return (
        <Dropdown
          isOpen={isOpen}
          onOpenChange={(isOpen: boolean) => setIsOpen(isOpen)}
          onSelect={handleSelect}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <Tooltip
                content={_("Bookmarks")}
                position={TooltipPosition.bottom}
                className={isOpen ? 'tooltip-hidden' : ''}
              >
                  <MenuToggle
                    id="bookmark-btn"
                    variant="secondary"
                    icon={<StarIcon />}
                    ref={toggleRef}
                    onClick={() => setIsOpen(!isOpen)}
                    isExpanded={isOpen}
                  />
              </Tooltip>
          )}
        >
            <DropdownList>
                {defaultBookmarks.map(defaultBookmark =>
                    <DropdownItem key={defaultBookmark.loc} value={defaultBookmark.loc}>
                        {defaultBookmark.name}
                    </DropdownItem>)}
                {bookmarks.length !== 0 &&
                    <Divider key="bookmark-divider" />}
                {bookmarks.map((bookmark: string) => (
                    <DropdownItem key={bookmark} value={bookmark}>
                        {bookmark}
                    </DropdownItem>))}
                {actionText !== null &&
                <>
                    <Divider key="bookmarks-divider" />
                    <DropdownItem key="bookmark-action" value="bookmark-action">
                        {actionText}
                    </DropdownItem>
                </>}
            </DropdownList>
        </Dropdown>
    );
}

// eslint-disable-next-line max-len
export function FilesBreadcrumbs({ path, showHidden, setShowHidden }: { path: string[], showHidden: boolean, setShowHidden: React.Dispatch<React.SetStateAction<boolean>>}) {
    const [editMode, setEditMode] = React.useState(false);
    const [newPath, setNewPath] = React.useState<string | null>(null);

    function navigate(n_parts: number) {
        cockpit.location.go("/", { path: encodeURIComponent(path.slice(0, n_parts).join("/")) });
    }

    const handleInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
        // Don't propogate navigation specific events
        if (event.key === "ArrowDown" || event.key === "ArrowUp" ||
            event.key === "ArrowLeft" || event.key === "ArrowRight" ||
            event.key === "Delete") {
            event.stopPropagation();
        }
        if (event.key === "Enter") {
            event.stopPropagation();
            changePath();
        } else if (event.key === "Escape") {
            cancelPathEdit();
        }
    };

    const enableEditMode = () => {
        setEditMode(true);
        setNewPath(path.join("/") || "/");
    };

    const changePath = () => {
        setEditMode(false);
        cockpit.assert(newPath !== null, "newPath cannot be null");
        // HACK: strip trailing / to circumvent the path being `//` in breadcrumbs
        cockpit.location.go("/", { path: encodeURIComponent(newPath.replace(/\/$/, '')) });
        setNewPath(null);
    };

    const cancelPathEdit = () => {
        setNewPath(null);
        setEditMode(false);
    };

    const onToggleHidden = () => {
        setShowHidden(prevShowHidden => {
            localStorage.setItem("files:showHiddenFiles", !showHidden ? "true" : "false");
            return !prevShowHidden;
        });
    };

    return (
        <PageBreadcrumb stickyOnBreakpoint={{ default: "top" }}>
            <Flex spaceItems={{ default: "spaceItemsSm" }}>
                <BookmarkButton path={path} />
                {!editMode &&
                    <Tooltip content={_("Edit path")} position={TooltipPosition.bottom}>
                        <Button
                          variant="secondary"
                          icon={<PencilAltIcon />}
                          onClick={() => enableEditMode()}
                          className="breadcrumb-button-edit"
                        />
                    </Tooltip>}
                {!editMode && path.map((dir, i) => {
                    return (
                        <React.Fragment key={i === 0 ? "__fsroot" : path.slice(0, i).join("/")}>
                            <Button
                              isDisabled={i === path.length - 1}
                              icon={i === 0 ? <OutlinedHddIcon /> : null}
                              variant="link" onClick={() => { navigate(i + 1) }}
                              className={`breadcrumb-button breadcrumb-${i}`}
                              aria-label={_("File system")}
                            >
                                {dir || "/"}
                            </Button>
                            {dir !== "" && <p className="path-divider" key={i}>/</p>}
                        </React.Fragment>
                    );
                })}
                {editMode && newPath !== null &&
                    <FlexItem flex={{ default: "flex_1" }}>
                        <TextInput
                          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                          id="new-path-input"
                          value={newPath}
                          onFocus={(event) => event.target.select()}
                          onKeyDown={handleInputKey}
                          onChange={(_event, value) => setNewPath(value)}
                        />
                    </FlexItem>}
                <FlexItem align={{ default: 'alignRight' }}>
                    {editMode &&
                    <>
                        <Button
                          variant="plain"
                          icon={<CheckIcon className="breadcrumb-edit-apply-icon" />}
                          onClick={changePath}
                          className="breadcrumb-button-edit-apply"
                        />
                        <Button
                          variant="plain"
                          icon={<TimesIcon />}
                          onClick={() => cancelPathEdit()}
                          className="breadcrumb-button-edit-cancel"
                        />
                    </>}
                    <KebabDropdown
                      toggleButtonId="global-settings-menu" dropdownItems={[
                          <DropdownItem
                            key="show-hidden-items"
                            id="show-hidden-items"
                            onClick={onToggleHidden}
                          >
                              <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                                  <FlexItem>{_("Show hidden items")}</FlexItem>
                                  <FlexItem>
                                      {showHidden &&
                                      <Icon size="sm">
                                          <CheckIcon className="check-icon" />
                                      </Icon>}
                                  </FlexItem>
                              </Flex>
                          </DropdownItem>
                      ]}
                    />
                </FlexItem>
            </Flex>
        </PageBreadcrumb>
    );
}
