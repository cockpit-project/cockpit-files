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

import React from "react";

import { AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert";

import cockpit from "cockpit";
import type { FileInfo } from "cockpit/fsinfo";
import type { Dialogs } from "dialogs";

import type { FolderFileInfo } from "./app";
import { basename } from "./common";
import { confirm_delete } from "./dialogs/delete";
import { show_create_directory_dialog } from "./dialogs/mkdir";
import { edit_permissions } from "./dialogs/permissions";
import { show_rename_dialog } from "./dialogs/rename";
import { downloadFile } from "./download";

const _ = cockpit.gettext;

type MenuItem =
	| { type: "divider" }
	| {
			type?: never;
			title: string;
			id: string;
			onClick: () => void;
			isDisabled?: boolean;
			className?: string;
	  };

export function get_menu_items(
	path: string[],
	selected: FolderFileInfo[],
	setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>,
	clipboard: string[],
	setClipboard: React.Dispatch<React.SetStateAction<string[]>>,
	cwdInfo: FileInfo | null,
	addAlert: (
		title: string,
		variant: AlertVariant,
		key: string,
		detail?: string,
	) => void,
	dialogs: Dialogs,
) {
	const currentPath = path.join("/") + "/";
	const menuItems: MenuItem[] = [];

	if (selected.length === 0) {
		menuItems.push(
			{
				id: "paste-item",
				title: _("Paste"),
				isDisabled: clipboard.length === 0,
				onClick: () => {
					const existingFiles = clipboard.filter(
						(sourcePath) => cwdInfo?.entries?.[basename(sourcePath)],
					);
					if (existingFiles.length > 0) {
						addAlert(
							_("Pasting failed"),
							AlertVariant.danger,
							"paste-error",
							cockpit.format(
								_('"$0" exists, not overwriting with paste.'),
								existingFiles.map(basename).join(", "),
							),
						);
						return;
					}
					cockpit
						.spawn(["cp", "-R", ...clipboard, currentPath])
						.catch((err) =>
							addAlert(
								err.message,
								AlertVariant.danger,
								`${new Date().getTime()}`,
							),
						);
				},
			},
			{ type: "divider" },
			{
				id: "create-item",
				title: _("Create directory"),
				onClick: () => show_create_directory_dialog(dialogs, currentPath),
			},
			{ type: "divider" },
			{
				id: "edit-permissions",
				title: _("Edit permissions"),
				onClick: () => edit_permissions(dialogs, null, path),
			},
		);
	} else if (selected.length === 1) {
		menuItems.push(
			{
				id: "copy-item",
				title: _("Copy"),
				onClick: () => setClipboard([currentPath + selected[0].name]),
			},
			{ type: "divider" },
			{
				id: "edit-permissions",
				title: _("Edit permissions"),
				onClick: () => edit_permissions(dialogs, selected[0], path),
			},
			{
				id: "rename-item",
				title: _("Rename"),
				onClick: () => show_rename_dialog(dialogs, path, selected[0]),
			},
			{ type: "divider" },
			{
				id: "delete-item",
				title: _("Delete"),
				className: "pf-m-danger",
				onClick: () =>
					confirm_delete(dialogs, currentPath, selected, setSelected),
			},
		);
		if (selected[0].type === "reg")
			menuItems.push(
				{ type: "divider" },
				{
					id: "download-item",
					title: _("Download"),
					onClick: () => downloadFile(currentPath, selected[0]),
				},
			);
	} else if (selected.length > 1) {
		menuItems.push(
			{
				id: "copy-item",
				title: _("Copy"),
				onClick: () =>
					setClipboard(selected.map((s) => path.join("/") + "/" + s.name)),
			},
			{
				id: "delete-item",
				title: _("Delete"),
				className: "pf-m-danger",
				onClick: () =>
					confirm_delete(dialogs, currentPath, selected, setSelected),
			},
		);
	}

	return menuItems;
}
