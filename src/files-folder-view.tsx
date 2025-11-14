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

import React, { useEffect, useState } from "react";

import { PageSection, PageGroup } from "@patternfly/react-core/dist/esm/components/Page";
import { debounce } from "throttle-debounce";

import type { FolderFileInfo, ClipboardInfo } from "./common.ts";
import { DropZone } from "./drag-drop.tsx";
import { FilesCardBody } from "./files-card-body.tsx";
import { FilesFooterDetail } from "./files-footer-detail.tsx";
import { as_sort, FilesCardHeader } from "./header.tsx";

export const FilesFolderView = ({
    path,
    files,
    loadingFiles,
    showHidden,
    selected,
    setSelected,
    clipboard,
    setClipboard,
    setShowHidden,
}: {
    path: string,
    files: FolderFileInfo[],
    loadingFiles: boolean,
    showHidden: boolean,
    setShowHidden: React.Dispatch<React.SetStateAction<boolean>>,
    selected: FolderFileInfo[], setSelected: React.Dispatch<React.SetStateAction<FolderFileInfo[]>>,
    clipboard: ClipboardInfo, setClipboard: React.Dispatch<React.SetStateAction<ClipboardInfo>>,
}) => {
    const [currentFilter, setCurrentFilter] = useState("");
    const [isGrid, setIsGrid] = useState(localStorage.getItem("files:isGrid") !== "false");
    const [sortBy, setSortBy] = useState(as_sort(localStorage.getItem("files:sort")));
    const onFilterChange = debounce(300,
                                    (_event: React.FormEvent<HTMLInputElement>, value: string) =>
                                        setCurrentFilter(value));

    // Reset the search filter on path changes
    useEffect(() => {
        setCurrentFilter("");
    }, [path]);

    return (
        <>
            <PageGroup isFilled hasOverflowScroll>
                <DropZone>
                    <PageSection>
                        <FilesCardHeader
                          currentFilter={currentFilter}
                          onFilterChange={onFilterChange}
                          isGrid={isGrid}
                          setIsGrid={setIsGrid}
                          sortBy={sortBy}
                          setSortBy={setSortBy}
                          path={path}
                          showHidden={showHidden}
                          setShowHidden={setShowHidden}
                          selected={selected}
                          setSelected={setSelected}
                          clipboard={clipboard}
                          setClipboard={setClipboard}
                        />
                    </PageSection>
                    <PageSection
                      isFilled
                      hasOverflowScroll
                      className="files-card"
                    >
                        <FilesCardBody
                          files={files}
                          currentFilter={currentFilter}
                          path={path}
                          isGrid={isGrid}
                          sortBy={sortBy}
                          setSortBy={setSortBy}
                          selected={selected}
                          setSelected={setSelected}
                          loadingFiles={loadingFiles}
                          clipboard={clipboard}
                          setClipboard={setClipboard}
                          showHidden={showHidden}
                          setShowHidden={setShowHidden}
                          setCurrentFilter={setCurrentFilter}
                        />
                    </PageSection>
                </DropZone>
            </PageGroup>
            <PageSection>
                <FilesFooterDetail
                  files={files}
                  selected={selected}
                  showHidden={showHidden}
                />
            </PageSection>
        </>
    );
};
