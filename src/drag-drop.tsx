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

import React, { useEffect, useState, useRef } from "react";

import { BanIcon, UploadIcon } from '@patternfly/react-icons';

import cockpit from "cockpit";
import { EmptyStatePanel } from "cockpit-components-empty-state";

import { useUploadContext } from "./app.tsx";

const _ = cockpit.gettext;

export const DropZone = ({
    children,
} : {
    children: React.ReactNode,
}) => {
    const { uploadedFiles } = useUploadContext();
    const dropzoneRef = useRef<HTMLDivElement>(null);
    const [dragDropActive, setDragDropActive] = useState(false);

    // counter to manage current status of drag&drop
    // dragging items over file entries causes a bunch of drag-enter and drag-leave
    // events, this counter helps checking when final drag-leave event is fired
    const dragDropCnt = useRef(0);

    const isUploading = Object.keys(uploadedFiles).length > 0;

    useEffect(() => {
        let dropzoneElem: HTMLDivElement | null = null;

        const handleDragEnter = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (!event.dataTransfer?.types.includes("Files")) {
                return;
            }

            if (dragDropCnt.current === 0) {
                setDragDropActive(true);
            }
            dragDropCnt.current++;
        };

        const handleDragLeave = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (!event.dataTransfer?.types.includes("Files")) {
                return;
            }

            dragDropCnt.current--;
            if (dragDropCnt.current === 0) {
                setDragDropActive(false);
            }
        };

        const handleDrop = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (!event.dataTransfer?.types.includes("Files")) {
                return;
            }

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
    }, [isUploading, dragDropCnt]);

    const dropzoneComponent = !isUploading
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
        <div className="upload-drop-zone" ref={dropzoneRef}>
            {dragDropActive && dropzoneComponent}
            {children}
        </div>
    );
};
