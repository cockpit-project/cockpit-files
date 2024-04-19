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
import { Card } from "@patternfly/react-core";

import { FolderFileInfo } from "./app";
import { FilesCardBody } from "./files-card-body.jsx";
import { FilesCardHeader } from "./header.jsx";

export const FilesFolderView = ({
    path,
    files,
    loadingFiles,
    showHidden,
    selected,
    setSelected,
    clipboard,
    setClipboard,
}: {
    path: string[],
    files: FolderFileInfo[],
    loadingFiles: boolean,
    showHidden: boolean,
    selected: FolderFileInfo[],
    setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>,
    clipboard: string[],
    setClipboard: React.Dispatch<React.SetStateAction<string[]>>,
}) => {
    const [currentFilter, setCurrentFilter] = useState("");
    const [isGrid, setIsGrid] = useState(localStorage.getItem("files:isGrid") !== "false");
    const [sortBy, setSortBy] = useState(localStorage.getItem("files:sort") || "az");
    const onFilterChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => setCurrentFilter(value);

    return (
        <Card>
            <FilesCardHeader
              currentFilter={currentFilter}
              onFilterChange={onFilterChange}
              isGrid={isGrid}
              setIsGrid={setIsGrid}
              sortBy={sortBy}
              setSortBy={setSortBy}
            />
            <FilesCardBody
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
              showHidden={showHidden}
            />
        </Card>
    );
};
