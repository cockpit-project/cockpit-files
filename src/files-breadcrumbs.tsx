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
import React, { useCallback, useEffect } from "react";

import { AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert";
import { Breadcrumb, BreadcrumbItem } from "@patternfly/react-core/dist/esm/components/Breadcrumb";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { Dropdown, DropdownItem, DropdownList } from "@patternfly/react-core/dist/esm/components/Dropdown";
import { MenuToggle, MenuToggleElement } from "@patternfly/react-core/dist/esm/components/MenuToggle";
import { PageBreadcrumb, PageSection, } from "@patternfly/react-core/dist/esm/components/Page";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Tooltip, TooltipPosition } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { CheckIcon, OutlinedHddIcon, PencilAltIcon, StarIcon, TimesIcon } from "@patternfly/react-icons";

import cockpit from "cockpit";
import { basename } from "cockpit-path";
import { useInit } from "hooks";

import { useFilesContext } from "./common.ts";

const _ = cockpit.gettext;

function BookmarkButton({ path }: { path: string }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [bookmarks, setBookmarks] = React.useState<string[]>([]);
    const [bookmarkHandle, setBookmarkHandle] = React.useState<cockpit.FileHandle<string> | null>(null);

    const { addAlert, cwdInfo } = useFilesContext();

    const defaultBookmarks = [];

    // Ensure the home dir has a trailing / like the path
    const home = cockpit.info.user.home;
    const home_dir = home.endsWith('/') ? home : `${home}/`;
    defaultBookmarks.push({ name: _("Home"), loc: home_dir }); // TODO: add trash

    const parse_uri = (line: string) => {
        // Drop everything after the space, we don't show renames
        line = line.replace(/\s.*/, '');

        // Drop the file:/// prefix
        line = line.replace('file://', '');

        // Nautilus decodes urls as paths can contain spaces
        let bookmark_path = line.split('/').map(part => decodeURIComponent(part))
                .join('/');

        // Ensure the bookmark has a trailing slash
        if (!bookmark_path.endsWith('/')) {
            bookmark_path = `${bookmark_path}/`;
        }

        return bookmark_path;
    };

    useInit(async () => {
        const handle = cockpit.file(`${home}/.config/gtk-3.0/bookmarks`);
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
            await bookmarkHandle.modify(old_content => {
                old_content ||= ''; // we treat a missing file the same as an empty one

                if (bookmarks.includes(path)) {
                    return old_content.split('\n').filter(line => parse_uri(line) !== path)
                            .join('\n');
                } else {
                    const newBookmark = "file://" + path.split('/').map(part => encodeURIComponent(part))
                            .join('/') + "\n";
                    return old_content + newBookmark;
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

    let actionText = null;
    if (!defaultBookmarks.some(bkmark => bkmark.loc === path)) {
        if (bookmarks.includes(path)) {
            actionText = _("Remove from bookmarks");
        } else if (cwdInfo !== null) {
            actionText = _("Add to bookmarks");
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

const PathBreadcrumbs = ({ path }: { path: string }) => {
    // Strip the trailing slash as it gets in the way when splitting paths and
    // adds an extra trailing slash in the UI which we don't want to show and
    // causes duplicate keys for the path `/`.
    const path_array = path.replace(/\/$/, "").split("/");

    function navigate(event: React.MouseEvent<HTMLElement>) {
        const { button, ctrlKey, metaKey } = event;
        const target = event.target as HTMLButtonElement;
        const isAnchor = target.matches("a");

        if (!target.parentElement)
            return;
        const link = target.parentElement.getAttribute("data-location");

        // Let the browser natively handle non-primary click events
        // or if the control or meta (Mac) keys are pressed
        // ...this lets opening in a new tab or window work by default.
        if (isAnchor && link && (button === 0 && !ctrlKey && !metaKey)) {
            event.preventDefault();
            cockpit.location.go("/", { path: encodeURIComponent(link) });
        }
    }

    return (
        <Breadcrumb onClick={(event) => navigate(event)}>
            {path_array.map((dir, i) => {
                const url_path = path_array.slice(0, i + 1).join("/") || '/';
                // We can't use a relative path as that will use the iframe's
                // url while we want the outer shell url. And we can't obtain
                // the full path of the shell easily, so a middle click will
                // open a files page without the shell.
                const link = `${window.location.pathname}#/?path=${url_path}`;

                return (
                    <BreadcrumbItem
                      key={url_path}
                      data-location={url_path}
                      to={link}
                      isActive={i === path_array.length - 1}
                    >
                        {i === 0 &&
                            <Tooltip
                              content={_("Filesystem")}
                              position={TooltipPosition.bottom}
                            >
                                <OutlinedHddIcon className="breadcrumb-hdd-icon" />
                            </Tooltip>}
                        {i !== 0 && dir}
                    </BreadcrumbItem>
                );
            })}
        </Breadcrumb>
    );
};

export function FilesBreadcrumbs({ path }: { path: string }) {
    const [editMode, setEditMode] = React.useState(false);
    const [newPath, setNewPath] = React.useState<string | null>(null);

    const enableEditMode = useCallback(() => {
        setEditMode(true);
        setNewPath(path);
    }, [path]);

    useEffect(() => {
        document.addEventListener("manual-change-dir", enableEditMode);

        return () => {
            document.removeEventListener("manual-change-dir", enableEditMode);
        };
    }, [enableEditMode]);

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

    return (
        <PageSection
          hasBodyWrapper={false}
          className="files-overview-header"
          padding={{ default: "padding" }}
        >
            <BookmarkButton path={path} />
            {!editMode &&
                <>
                    <Tooltip content={_("Edit path")} position={TooltipPosition.bottom}>
                        <Button
                          variant="secondary"
                          icon={<PencilAltIcon />}
                          onClick={() => enableEditMode()}
                          className="breadcrumb-button-edit"
                        />
                    </Tooltip>
                    <PageBreadcrumb hasBodyWrapper={false}>
                        <PathBreadcrumbs path={path} />
                    </PageBreadcrumb>
                </>}
            {editMode && newPath !== null &&
                <TextInput
                  autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                  id="new-path-input"
                  value={newPath}
                  onFocus={(event) => event.target.select()}
                  onKeyDown={handleInputKey}
                  onChange={(_event, value) => setNewPath(value)}
                />}
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
        </PageSection>
    );
}
