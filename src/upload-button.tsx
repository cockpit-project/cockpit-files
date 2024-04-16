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

import cockpit from "cockpit";
import React, { useState, useRef } from "react";

import {
    AlertVariant,
    Button,
    Checkbox,
    Divider,
    Modal,
    ModalVariant,
    Popover,
    PopoverPosition,
    Progress,
    Flex,
    FlexItem,
} from "@patternfly/react-core";
import { TrashIcon } from "@patternfly/react-icons";

import { upload } from "cockpit-upload-helper";
import { fmt_to_fragments } from "utils.jsx";
import { useDialogs } from "dialogs.jsx";
import * as timeformat from "timeformat";

import { useFilesContext } from "./app";
import { FileInfo } from "./fsinfo";

import "./upload-button.scss";

const _ = cockpit.gettext;

const FileConflictDialog = ({
    path,
    file,
    uploadFile,
    isMultiUpload,
}: {
    path: string[];
    file: FileInfo,
    uploadFile: File,
    isMultiUpload: boolean,
}) => {
    const Dialogs = useDialogs();
    const [applyToAll, setApplyToAll] = React.useState<boolean>(false);

    const handleReplace = () => {
        Dialogs.close({ replace: true, applyToAll });
    };

    const handleSkip = () => {
        Dialogs.close({ skip: true, applyToAll });
    };

    const handleCancel = () => {
        Dialogs.reject(new Error("cancelled"));
    };

    return (
        <Modal
          position="top"
          // @ts-expect-error incorrect PatternFly typing https://github.com/patternfly/patternfly-react/issues/10361
          title={fmt_to_fragments(_("Replace file $0?"), <b>{uploadFile.name}</b>)}
          titleIconVariant="warning"
          variant={ModalVariant.medium}
          onClose={handleCancel}
          isOpen
          footer={
              <>
                  <Button variant="warning" onClick={handleReplace}>{_("Replace")}</Button>
                  {isMultiUpload &&
                  <Button variant="secondary" onClick={handleSkip}>{_("Keep original")}</Button>}
                  <Button variant="link" onClick={handleCancel}>{_("Cancel")}</Button>
              </>
          }
        >
            <p>
                {cockpit.format(
                    _("A file with the same name already exists in \"$0\". Replacing it will overwrite its content."),
                    path.join('/')
                )}
            </p>
            <Flex
              spaceItems={{ default: "spaceItems3xl" }}
              className="conflict-modal-files"
            >
                <FlexItem>
                    <b>{_("New file")}</b>
                    <p>{cockpit.format_bytes(uploadFile.size)}</p>
                    <p>{timeformat.dateTime(uploadFile.lastModified)}</p>
                </FlexItem>
                <FlexItem>
                    <b>{_("Original file on server")}</b>
                    <p>{cockpit.format_bytes(file.size)}</p>
                    {file.mtime &&
                    <p>{timeformat.dateTime(file.mtime * 1000)}</p>}
                </FlexItem>
            </Flex>
            {isMultiUpload &&
            <Checkbox
              id="replace-all"
              label={_("Apply this action to all conflicting files")}
              isChecked={applyToAll}
              onChange={() => setApplyToAll(!applyToAll)}
            />}
        </Modal>
    );
};

export const UploadButton = ({
    path,
} : {
    path: string[],
}) => {
    const ref = useRef<HTMLInputElement>(null);
    const { addAlert, cwdInfo } = useFilesContext();
    const Dialogs = useDialogs();
    const [showPopover, setPopover] = React.useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<{[name: string]:
                                                        {file: File, progress: number, cancel:() => void}}>({});

    const handleClick = () => {
        if (ref.current) {
            ref.current.click();
        }
    };

    // Show a confirmation before closing the tab while uploading
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
        event.preventDefault();

        // Included for legacy support, e.g. Chrome/Edge < 119
        event.returnValue = true;
    };

    const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        cockpit.assert(event.target.files, "not an <input type='file'>?");
        cockpit.assert(cwdInfo?.entries, "cwdInfo.entries is undefined");
        let next_progress = 0;
        const toUploadFiles = [];

        const resetInput = () => {
        // Reset input field in the case a download was cancelled and has to be re-uploaded
        // https://stackoverflow.com/questions/26634616/filereader-upload-same-file-again-not-working
            event.target.value = "";
        };

        let resolution;
        let replaceAll = false;
        let skipAll = false;
        for (let i = 0; i < event.target.files.length; i++) {
            const inputFile = event.target.files[i];
            const file = cwdInfo?.entries[inputFile.name];

            if (replaceAll)
                toUploadFiles.push(inputFile);
            else if (file && skipAll) {
                continue;
            } else if (file) {
                try {
                    resolution = await Dialogs.show(
                        <FileConflictDialog
                          path={path}
                          file={file}
                          uploadFile={inputFile}
                          isMultiUpload={event.target.files.length > 1}
                        />
                    );
                } catch (exc) {
                    resetInput();
                    return;
                }

                if (resolution.skip) {
                    if (resolution.applyToAll)
                        skipAll = true;
                    continue;
                }

                if (resolution.applyToAll && resolution.replace)
                    replaceAll = true;

                toUploadFiles.push(inputFile);
            } else {
                toUploadFiles.push(inputFile);
            }
        }

        if (toUploadFiles.length === 0) {
            resetInput();
            return;
        }

        window.addEventListener("beforeunload", beforeUnloadHandler);

        const cancelledUploads = [];
        await Promise.allSettled(toUploadFiles.map(async (file: File) => {
            const tmp_path = path.slice();
            tmp_path.push(file.name);
            const destination = tmp_path.join('/');
            const abort = new AbortController();

            setUploadedFiles(oldFiles => {
                return {
                    [file.name]: { file, progress: 0, cancel: () => abort.abort() },
                    ...oldFiles,
                };
            });

            try {
                await upload(destination, file, (progress) => {
                    const now = performance.now();
                    if (now < next_progress)
                        return;
                    next_progress = now + 200; // only rerender every 200ms
                    setUploadedFiles(oldFiles => {
                        const oldFile = oldFiles[file.name];
                        return {
                            ...oldFiles,
                            [file.name]: { ...oldFile, progress },
                        };
                    });
                }, abort.signal);
                // TODO: pass { superuser: try } depending on directory owner
            } catch (exc) {
                cockpit.assert(exc instanceof Error, "Unknown exception type");
                if (exc instanceof DOMException && exc.name === 'AbortError') {
                    addAlert(_("Cancelled"), AlertVariant.warning, "upload",
                             cockpit.format(_("Cancelled upload of $0"), file.name));
                } else {
                    addAlert(_("Upload error"), AlertVariant.danger, "upload-error", exc.toString());
                }
                cancelledUploads.push(file);
            } finally {
                setUploadedFiles(oldFiles => {
                    const copy = { ...oldFiles };
                    delete copy[file.name];
                    return copy;
                });
            }
        }));

        resetInput();
        window.removeEventListener("beforeunload", beforeUnloadHandler);

        // If all uploads are cancelled, don't show an alert
        if (cancelledUploads.length !== toUploadFiles.length) {
            addAlert(_("Upload complete"), AlertVariant.success, "upload-success", _("Successfully uploaded file(s)"));
        }
    };

    const isUploading = Object.keys(uploadedFiles).length !== 0;
    let icon;

    if (isUploading) {
        let totalSize = 0;
        let totalSent = 0;

        Object.keys(uploadedFiles).forEach((key) => {
            const uploadedFile = uploadedFiles[key];
            totalSize += uploadedFile.file.size;
            totalSent += uploadedFile.progress;
        });

        const overallProgress = ((totalSent / totalSize) * 100).toFixed(2);

        icon = (
            <Button
              onClick={() => setPopover(true)}
              className="progress-wrapper"
              variant="plain"
              icon={
                  <div
                    id="upload-progress-btn"
                    className="progress-pie"
                    title={cockpit.format(_("Upload $0% completed"), overallProgress)}
                    style={{ "--progress": `${overallProgress}%` } as React.CSSProperties}
                  />
              }
            />
        );
    }

    return (
        <>
            <Popover
              className="upload-popover"
              position={PopoverPosition.bottom}
              headerContent={<p>{_("Uploads")}</p>}
              bodyContent={Object.keys(uploadedFiles).map((key, index) => {
                  const file = uploadedFiles[key];
                  return (
                      <React.Fragment key={index}>
                          <Divider />
                          <Flex className="upload-progress-flex" flexWrap={{ default: 'nowrap' }}>
                              <Progress
                                key={file.file.name}
                                className={`upload-progress-${index} upload-progress pf-v5-m-tabular-nums`}
                                value={file.progress}
                                title={file.file.name}
                                max={file.file.size}
                              />
                              <Button
                                variant="plain"
                                icon={<TrashIcon />}
                                className={`cancel-button-${index} cancel-button`}
                                onClick={file.cancel}
                                aria-label={cockpit.format(_("Cancel upload of $0"), file.file.name)}
                              />
                          </Flex>
                      </React.Fragment>
                  );
              })}
              isVisible={showPopover}
              shouldClose={() => setPopover(false)}
            >
                {icon}
            </Popover>
            <Button
              id="upload-file-btn"
              className="upload-button"
              variant="secondary"
              isDisabled={isUploading || cwdInfo?.entries === undefined}
              onClick={handleClick}
            >
                {_("Upload")}
            </Button>
            <input
              ref={ref}
              type="file"
              hidden
              multiple
              onChange={onUpload}
            />
        </>
    );
};
