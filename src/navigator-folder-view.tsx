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
import { AlertVariant, Card } from "@patternfly/react-core";

import { NavigatorFileInfo } from "./app";
import { NavigatorCardBody } from "./navigator-card-body.jsx";
import { NavigatorCardHeader } from "./header.jsx";

export const NavigatorFolderView = ({
    path,
    files,
    loadingFiles,
    showHidden,
    selected,
    setSelected,
    clipboard,
    setClipboard,
    addAlert,
}: {
    path: string[],
    files: NavigatorFileInfo[],
    loadingFiles: boolean,
    showHidden: boolean,
    selected: NavigatorFileInfo[],
    setSelected: React.Dispatch<React.SetStateAction<NavigatorFileInfo[]>>,
    clipboard: string[],
    setClipboard: React.Dispatch<React.SetStateAction<string[]>>,
    addAlert: (title: string, variant: AlertVariant, key: string) => void,
}) => {
    const [currentFilter, setCurrentFilter] = useState("");
    const [isGrid, setIsGrid] = useState(localStorage.getItem("navigator:isGrid") !== "false");
    const [sortBy, setSortBy] = useState(localStorage.getItem("cockpit-navigator.sort") || "az");
    const onFilterChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => setCurrentFilter(value);

    return (
        <Card>
            <NavigatorCardHeader
              currentFilter={currentFilter}
              onFilterChange={onFilterChange}
              isGrid={isGrid}
              setIsGrid={setIsGrid}
              sortBy={sortBy}
              setSortBy={setSortBy}
            />
            <NavigatorCardBody
              files={files}
              currentFilter={currentFilter}
              path={path}
              isGrid={isGrid}
              sortBy={sortBy}
              selected={selected}
              setSelected={setSelected}
              loadingFiles={loadingFiles}
              clipboard={clipboard}
              setClipboard={setClipboard}
              addAlert={addAlert}
              showHidden={showHidden}
            />
        </Card>
    );
};
