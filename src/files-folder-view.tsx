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

import React, { createContext, useContext, useEffect, useState, useRef } from "react";

import { Card } from '@patternfly/react-core/dist/esm/components/Card';
import { BanIcon, UploadIcon } from '@patternfly/react-icons';
import { debounce } from "throttle-debounce";

import cockpit from "cockpit";
import { EmptyStatePanel } from "cockpit-components-empty-state";

import type { FolderFileInfo, ClipboardInfo } from "./common.ts";
import { FilesCardBody } from "./files-card-body.tsx";
import { as_sort, FilesCardHeader } from "./header.tsx";

const _ = cockpit.gettext;

export interface UploadedFilesType {[name: string]:{file: File, progress: number, cancel:() => void}}

interface UploadContextType {
    uploadedFiles: UploadedFilesType,
    setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFilesType>>,
}

export const UploadContext = createContext({
    uploadedFiles: {},
    setUploadedFiles: () => console.warn("UploadContext not initialized!"),
} as UploadContextType);

export const useUploadContext = () => useContext(UploadContext);

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
    const dropzoneRef = useRef<HTMLDivElement>(null);
    const [currentFilter, setCurrentFilter] = useState("");
    const [isGrid, setIsGrid] = useState(localStorage.getItem("files:isGrid") !== "false");
    const [sortBy, setSortBy] = useState(as_sort(localStorage.getItem("files:sort")));
    const [dragDropActive, setDragDropActive] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<{[name: string]:
                                                        {file: File, progress: number, cancel:() => void}}>({});
    const onFilterChange = debounce(300,
                                    (_event: React.FormEvent<HTMLInputElement>, value: string) =>
                                        setCurrentFilter(value));

    // Reset the search filter on path changes
    useEffect(() => {
        setCurrentFilter("");
    }, [path]);

    // counter to manage current status of drag&drop
    // dragging items over file entries causes a bunch of drag-enter and drag-leave
    // events, this counter helps checking when final drag-leave event is fired
    const dragDropCnt = useRef(0);

    useEffect(() => {
        let dropzoneElem: HTMLDivElement | null = null;
        const isUploading = Object.keys(uploadedFiles).length !== 0;

        const handleDragEnter = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (dragDropCnt.current === 0) {
                setDragDropActive(true);
            }
            dragDropCnt.current++;
        };

        const handleDragLeave = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();

            dragDropCnt.current--;
            if (dragDropCnt.current === 0) {
                setDragDropActive(false);
            }
        };

        const handleDrop = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();

            setDragDropActive(false);
            dragDropCnt.current = 0;

            // disable drag & drop when upload is in progress
            if (isUploading) {
                return;
            }

            cockpit.assert(event.dataTransfer !== null, "dataTransfer cannot be null");
            dispatchEvent(new CustomEvent('files-drop', { detail: event.dataTransfer.files }));
        };

        const handleDragOver = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
        };

        if (dropzoneRef.current) {
            dropzoneElem = dropzoneRef.current;
            dropzoneElem.addEventListener("dragenter", handleDragEnter);
            dropzoneElem.addEventListener("dragleave", handleDragLeave);
            dropzoneElem.addEventListener("dragover", handleDragOver, false);
            dropzoneElem.addEventListener("drop", handleDrop, false);
        }

        return () => {
            if (dropzoneElem) {
                dropzoneElem.removeEventListener("dragenter", handleDragEnter);
                dropzoneElem.removeEventListener("dragover", handleDragOver);
                dropzoneElem.removeEventListener("dragleave", handleDragLeave);
                dropzoneElem.removeEventListener("drop", handleDrop);
            }
        };
    }, [uploadedFiles, dragDropCnt]);

    const dropzoneComponent = (Object.keys(uploadedFiles).length === 0)
        ? (
            <div className="drag-drop-upload">
                <EmptyStatePanel
                  icon={UploadIcon}
                  title={_("Drop files to upload")}
                />
            </div>
        )
        : (
            <div className="drag-drop-upload-blocked">
                <EmptyStatePanel
                  icon={BanIcon}
                  title={_("Cannot drop files, another upload is already in progress")}
                />
            </div>
        );

    return (
        <UploadContext.Provider value={{ uploadedFiles, setUploadedFiles }}>
            <div className="upload-drop-zone" ref={dropzoneRef}>
                <Card className="files-card">
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
                    {dragDropActive && dropzoneComponent}
                </Card>
            </div>
        </UploadContext.Provider>
    );
};
