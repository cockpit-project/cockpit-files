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

import cockpit from "cockpit";
import React, { useRef, useState } from "react";

import {
    Button,
    CardHeader,
    CardTitle,
    Flex,
    MenuToggle,
    MenuToggleAction,
    SearchInput,
    Select,
    SelectList,
    SelectOption,
    Text,
    TextContent,
    TextVariants
} from "@patternfly/react-core";
import { GripVerticalIcon, ListIcon } from "@patternfly/react-icons";

const _ = cockpit.gettext;

export const NavigatorCardHeader = ({
    currentFilter, onFilterChange, isGrid, setIsGrid, sortBy, setSortBy, currentDir, files
}) => {
    const [chunksProgress, setChunksProgress] = useState({ number: 0, completed: 0 });
    const [isUploading, setIsUploading] = useState(false);
    return (
        <CardHeader className="card-actionbar">
            <CardTitle component="h2" id="navigator-card-header">
                <TextContent>
                    <Text component={TextVariants.h2}>
                        {_("Directories & files")}
                    </Text>
                </TextContent>
            </CardTitle>
            <Flex flexWrap={{ default: "nowrap" }} alignItems={{ default: "alignItemsCenter" }}>
                <SearchInput
                  placeholder={_("Filter directory")} value={currentFilter}
                  onChange={onFilterChange}
                />
                <ViewSelector
                  isGrid={isGrid} setIsGrid={setIsGrid}
                  setSortBy={setSortBy} sortBy={sortBy}
                />
                <UploadButton
                  files={files} setChunksProgress={setChunksProgress}
                  isUploading={isUploading} setIsUploading={setIsUploading}
                />
                <UploadProgress chunksProgress={chunksProgress} />
            </Flex>
        </CardHeader>
    );
};

const ViewSelector = ({ isGrid, setIsGrid, sortBy, setSortBy }) => {
    const [isOpen, setIsOpen] = useState(false);
    const onToggleClick = isOpen => setIsOpen(!isOpen);
    const onSelect = (ev, itemId) => {
        setIsOpen(false);
        setSortBy(itemId);
        localStorage.setItem("cockpit-navigator.sort", itemId);
    };

    return (
        <Select
          id="sort-menu"
          isOpen={isOpen}
          selected={sortBy}
          onSelect={onSelect}
          onOpenChange={setIsOpen}
          popperProps={{ position: "right" }}
          toggle={toggleRef => (
              <MenuToggle
                id="sort-menu-toggle"
                className="view-toggle-group"
                isExpanded={isOpen}
                onClick={() => onToggleClick(isOpen)}
                ref={toggleRef}
                splitButtonOptions={{
                    variant: "action",
                    items: [
                        <MenuToggleAction
                          aria-label={isGrid
                              ? _("Display as a list")
                              : _("Display as a grid")}
                          key="view-toggle-action"
                          onClick={() => setIsGrid(!isGrid)}
                        >
                            {isGrid
                                ? <ListIcon className="view-toggle-icon" />
                                : <GripVerticalIcon className="view-toggle-icon" />}
                        </MenuToggleAction>
                    ]
                }}
                variant="secondary"
              />
          )}
        >
            <SelectList>
                <SelectOption itemId="az">{_("A-Z")}</SelectOption>
                <SelectOption itemId="za">{_("Z-A")}</SelectOption>
                <SelectOption itemId="last_modified">{_("Last modified")}</SelectOption>
                <SelectOption itemId="first_modified">{_("First modified")}</SelectOption>
            </SelectList>
        </Select>
    );
};

const UploadButton = ({ files, setChunksProgress, isUploading, setIsUploading }) => {
    const ref = useRef();

    const handleClick = () => {
        ref.current.click();
    };

    const onUpload = e => {
        const uploadedFile = e.target.files[0];

        let fileName = uploadedFile.name;

        let fileCount = 2;
        if (files.some(f => f.name === fileName))
            fileName += " (1)";
        while (files.some(f => f.name === fileName)) {
            fileName = fileName.substring(0, fileName.length - 2) + `${fileCount}` + ")";
            fileCount += 1;
        }

        let offset = 0;
        let nextOffset = 0;
        const chunkSize = 65536;
        const chunks = [];
        const numChunks = Math.ceil(uploadedFile.size / chunkSize);
        setChunksProgress({ completed: 0, number: numChunks });

        for (let i = 0; i < numChunks; i++) {
            nextOffset = Math.min(chunkSize * (i + 1), uploadedFile.size);
            chunks.push(uploadedFile.slice(offset, nextOffset));
            offset = nextOffset;
        }

        cockpit.spawn(["mktemp", "-t", `cockpit-upload-${fileName}-XXXXX`])
                .then(tempPath => {
                    const process = cockpit.spawn(
                        ["dd", "status=none", `of=${tempPath}`],
                        { superuser: "try", binary: true }
                    );
                    const reader = new FileReader();

                    let chunkIndex = 0;
                    reader.readAsArrayBuffer(chunks[0]);
                    reader.onload = readerEvent => {
                        process.input(new Uint8Array(readerEvent.target.result), true);
                        setChunksProgress(c => {
                            return { ...c, completed: c.completed + 1 };
                        });
                        chunkIndex += 1;
                        if (chunkIndex < numChunks) {
                            reader.readAsArrayBuffer(chunks[chunkIndex]);
                        } else {
                            process.input();
                            cockpit.spawn(["mv", tempPath, `/home/mahmoud/${fileName}`], { superuser: "try" })
                                    .then(() => {
                                        // trim newline character
                                        cockpit.spawn(["rm", tempPath.substring(0, tempPath.length - 1)]);
                                    });
                        }
                    };
                });
    };

    return (
        <>
            <Button variant="secondary" onClick={handleClick}>Upload</Button>
            <input
              ref={ref} type="file"
              hidden onChange={onUpload}
            />
        </>
    );
};

const UploadProgress = ({ chunksProgress }) => {
    const progress = Math.round(100 * chunksProgress.completed / (chunksProgress.number || 1));
    console.log(progress);
    return (
        <div
          id="progress" className="progress-pie"
          title={`Upload ${progress}% completed`} style={{ "--progress": `${progress}%` }}
        />
    );
};
