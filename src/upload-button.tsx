/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2024 Red Hat, Inc.
 */

import React, { useRef, useCallback, useContext, useEffect } from "react";

import { AlertVariant, AlertActionLink } from "@patternfly/react-core/dist/esm/components/Alert";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import {
    Modal, ModalBody, ModalFooter, ModalHeader, ModalVariant
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Popover, PopoverPosition } from "@patternfly/react-core/dist/esm/components/Popover";
import { Progress } from "@patternfly/react-core/dist/esm/components/Progress";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { TrashIcon } from "@patternfly/react-icons";

import cockpit, { BasicError } from "cockpit";
import { fsinfo, type FileInfo } from "cockpit/fsinfo.ts";
import { upload } from "cockpit-upload-helper";
import { DialogResult, useDialogs } from "dialogs";
import { superuser } from "superuser";
import * as timeformat from "timeformat";
import { fmt_to_fragments } from "utils";

import { permissionShortStr, uniqueId, useFilesContext } from "./common.ts";
import type { FolderFileInfo } from "./common.ts";
import { edit_permissions } from "./dialogs/permissions.tsx";
import { UploadContext } from "./files-folder-view.tsx";
import { get_owner_candidates } from "./ownership.tsx";

import "./upload-button.css";

const _ = cockpit.gettext;

interface ConflictResult {
    replace?: true;
    skip?: true;
    applyToAll: boolean;
}

const UploadedFilesList = ({
    files,
    modes,
    owner,
}: {
  files: File[],
  modes: number[],
  owner: string,
}) => {
    cockpit.assert(modes.length !== 0, "modes cannot be empty");
    const permission = permissionShortStr(modes[0]);
    const title = files.length === 1 ? files[0].name : cockpit.format(_("$0 files"), files.length);
    return (
        <>
            <p>{title}</p>
            {owner && <p className="ct-grey-text">{cockpit.format(_("Uploaded as $0, $1"), owner, permission)}</p>}
        </>
    );
};

const FileConflictDialog = ({
    path,
    file,
    uploadFile,
    isMultiUpload,
    dialogResult
}: {
    path: string;
    file: FileInfo,
    uploadFile: File,
    isMultiUpload: boolean,
    dialogResult: DialogResult<ConflictResult>
}) => {
    const [applyToAll, setApplyToAll] = React.useState<boolean>(false);

    const handleReplace = () => {
        dialogResult.resolve({ replace: true, applyToAll });
    };

    const handleSkip = () => {
        dialogResult.resolve({ skip: true, applyToAll });
    };

    const handleCancel = () => {
        dialogResult.reject(new Error("cancelled"));
    };

    const modalHeader = (
        <ModalHeader
          titleIconVariant="warning"
          title={fmt_to_fragments(_("Replace file $0?"), <b className="ct-heading-font-weight">{uploadFile.name}</b>)}
        />
    );

    const alreadyExistsWarning = (
        <p>
            {cockpit.format(
                _("A file with the same name already exists in \"$0\". Replacing it will overwrite its content."),
                path
            )}
        </p>
    );

    return (
        <Modal
          position="top"
          variant={ModalVariant.medium}
          onClose={handleCancel}
          isOpen
        >
            {modalHeader}
            <ModalBody>
                {alreadyExistsWarning}
                <Flex
                  spaceItems={{ default: "spaceItems3xl" }}
                  className="conflict-modal-files"
                >
                    <FlexItem>
                        <b>{_("New file")}</b>
                        <p>{cockpit.format_bytes(uploadFile.size)}</p>
                        <p className="new-file-date">{timeformat.dateTime(uploadFile.lastModified)}</p>
                    </FlexItem>
                    <FlexItem>
                        <b>{_("Original file on server")}</b>
                        <p>{cockpit.format_bytes(file.size)}</p>
                        {file.mtime &&
                        <p className="original-file-date">{timeformat.dateTime(file.mtime * 1000)}</p>}
                    </FlexItem>
                </Flex>
                {isMultiUpload &&
                <Checkbox
                  id="replace-all"
                  label={_("Apply this action to all conflicting files")}
                  isChecked={applyToAll}
                  onChange={() => setApplyToAll(!applyToAll)}
                />}
            </ModalBody>
            <ModalFooter>
                <Button variant="warning" onClick={handleReplace}>{_("Replace")}</Button>
                {isMultiUpload &&
                <Button variant="secondary" onClick={handleSkip}>{_("Keep original")}</Button>}
                <Button variant="link" onClick={handleCancel}>{_("Cancel")}</Button>
            </ModalFooter>
        </Modal>
    );
};

export const UploadButton = ({
    path,
} : {
    path: string,
}) => {
    const ref = useRef<HTMLInputElement>(null);
    const { addAlert, removeAlert, cwdInfo } = useFilesContext();
    const dialogs = useDialogs();
    const [showPopover, setPopover] = React.useState(false);
    const { uploadedFiles, setUploadedFiles } = useContext(UploadContext);

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

    const onUpload = useCallback(async (files: FileList, event?: React.ChangeEvent<HTMLInputElement>) => {
        cockpit.assert(cwdInfo?.entries, "cwdInfo.entries is undefined");
        let next_progress = 0;
        let owner = null;
        const toUploadFiles: File[] = [];

        // When we are superuser upload as the owner of the directory and allow
        // the user to later change ownership if required.
        if (superuser.allowed && cwdInfo) {
            const candidates = get_owner_candidates(cwdInfo);
            owner = [...candidates][0];
        }

        const resetInput = () => {
        // Reset input field in the case a download was cancelled and has to be re-uploaded
        // https://stackoverflow.com/questions/26634616/filereader-upload-same-file-again-not-working
            if (event)
                event.target.value = "";
        };

        let resolution;
        let replaceAll = false;
        let skipAll = false;
        for (let i = 0; i < files.length; i++) {
            const uploadFile = files[i];
            const file = cwdInfo?.entries[uploadFile.name];

            if (replaceAll)
                toUploadFiles.push(uploadFile);
            else if (file && skipAll) {
                continue;
            } else if (file) {
                try {
                    resolution = await dialogs.run(FileConflictDialog, {
                        path, file, uploadFile, isMultiUpload: files.length > 1
                    });
                } catch (_exc) { // eslint-disable-line @typescript-eslint/no-unused-vars
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

                toUploadFiles.push(uploadFile);
            } else {
                toUploadFiles.push(uploadFile);
            }
        }

        if (toUploadFiles.length === 0) {
            resetInput();
            return;
        }

        window.addEventListener("beforeunload", beforeUnloadHandler);

        const cancelledUploads: File[] = [];
        const fileModes: number[] = [];
        await Promise.allSettled(toUploadFiles.map(async (file: File) => {
            let destination = path + file.name;
            const abort = new AbortController();
            let options = { };

            setUploadedFiles(oldFiles => {
                return {
                    [file.name]: { file, progress: 0, cancel: () => abort.abort() },
                    ...oldFiles,
                };
            });

            if (owner !== null) {
                destination = `${path}.${file.name}.tmp`;
                // The cockpit.file() API does not support setting an owner/group when uploading a new
                // file with fsreplace1. This requires a re-design of the Files API:
                // https://issues.redhat.com/browse/COCKPIT-1215
                //
                // For now we create an empty file using fsreplace1 and give it the proper ownership and using that tag
                // upload the to be uploaded file. This prevents uploading with the wrong ownership.
                //
                // To support changing permissions after upload with our change permissions dialog we obtain the
                // file mode using `stat` as fsreplace1 does not report this back except via the `tag` which is not
                // a stable interface.
                try {
                    await cockpit.file(destination, { superuser: "try" }).replace("");
                    await cockpit.spawn(["chown", owner, destination], { superuser: "try" });
                    const { tag } = await fsinfo(destination, ['tag'], { superuser: "try" });
                    options = { superuser: "try", tag };
                    const stat = await cockpit.spawn(["stat", "--format", "%a", destination], { superuser: "try" });
                    fileModes.push(Number.parseInt(stat.trimEnd(), 8));
                } catch (exc) {
                    const err = exc as BasicError;
                    console.warn("Cannot set initial file permissions", err.toString());
                    addAlert({
                        title: _("Failed"),
                        variant: AlertVariant.warning,
                        detail: err.toString()
                    });

                    try {
                        await cockpit.file(destination, { superuser: "require" }).replace(null);
                    } catch (exc) {
                        console.warn(`Unable to cleanup file: ${destination}, err: ${exc}`);
                    }

                    cancelledUploads.push(file);
                    setUploadedFiles(oldFiles => {
                        const copy = { ...oldFiles };
                        delete copy[file.name];
                        return copy;
                    });

                    return;
                }
            }

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
                }, abort.signal, options);

                if (owner !== null) {
                    try {
                        await cockpit.spawn(["mv", destination, path + file.name],
                                            { superuser: "require" });
                    } catch (exc) {
                        console.warn("Unable to move file to final destination", exc);
                        addAlert({
                            title: _("Upload error"),
                            variant: AlertVariant.danger,
                            detail: _("Unable to move uploaded file to final destination")
                        });
                        try {
                            await cockpit.file(destination, { superuser: "require" }).replace(null);
                        } catch (exc) {
                            console.warn(`Unable to cleanup file: ${destination}, err: ${exc}`);
                        }
                    }
                }
            } catch (exc) {
                cockpit.assert(exc instanceof Error, "Unknown exception type");

                // Clean up touched file
                if (owner) {
                    try {
                        await cockpit.file(destination, { superuser: "require" }).replace(null);
                    } catch (exc) {
                        console.warn(`Unable to cleanup file: ${destination}, err: ${exc}`);
                    }
                }
                if (exc instanceof DOMException && exc.name === 'AbortError') {
                    addAlert({
                        title: _("Cancelled"),
                        variant: AlertVariant.warning,
                        detail: cockpit.format(_("Cancelled upload of $0"), file.name)
                    });
                } else {
                    addAlert({
                        title: _("Upload error"),
                        variant: AlertVariant.danger,
                        detail: exc.toString()
                    });
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

        const actuallyUploadedFiles = toUploadFiles.filter(f => !cancelledUploads.includes(f));

        // If all uploads are cancelled, don't show an alert
        if (actuallyUploadedFiles.length !== 0) {
            const title = cockpit.ngettext(_("File uploaded"), _("Files uploaded"), actuallyUploadedFiles.length);
            const key = uniqueId();
            let description;
            let action;

            if (owner !== null) {
                description = (
                    <UploadedFilesList
                      files={actuallyUploadedFiles}
                      modes={fileModes}
                      owner={owner}
                    />
                );
                action = (
                    <AlertActionLink
                      onClick={() => {
                          removeAlert(key);
                          const [user, group] = owner.split(':');
                          const uploadedFiles: FolderFileInfo[] = actuallyUploadedFiles.map((file, idx) => {
                              return {
                                  name: file.name,
                                  to: null,
                                  category: null,
                                  user,
                                  group,
                                  mode: fileModes[idx]
                              };
                          });
                          edit_permissions(dialogs, uploadedFiles, path);
                      }}
                    >
                        {_("Change permissions")}
                    </AlertActionLink>
                );
            }

            addAlert({
                title,
                key,
                variant: AlertVariant.success,
                detail: description,
                actionLinks: action
            });
        }
    }, [
        addAlert,
        removeAlert,
        cwdInfo,
        dialogs,
        path,
        setUploadedFiles,
    ]);

    useEffect(() => {
        const handleFilesDrop = ((event: CustomEvent) => {
            onUpload(event.detail);
        }) as EventListener;

        window.addEventListener("files-drop", handleFilesDrop);

        return () => {
            window.removeEventListener("files-drop", handleFilesDrop);
        };
    }, [path, cwdInfo, onUpload]);

    const isUploading = Object.keys(uploadedFiles).length !== 0;
    let popover;

    if (isUploading) {
        let totalSize = 0;
        let totalSent = 0;

        Object.keys(uploadedFiles).forEach((key) => {
            const uploadedFile = uploadedFiles[key];
            totalSize += uploadedFile.file.size;
            totalSent += uploadedFile.progress;
        });

        const overallProgress = ((totalSent / totalSize) * 100).toFixed(2);

        popover = (
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
                                className={`upload-progress-${index} upload-progress pf-v6-m-tabular-nums`}
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
            </Popover>
        );
    }

    return (
        <>
            {popover}
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
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  cockpit.assert(event?.target.files, "not an <input type='file'>?");
                  onUpload(event.target.files, event);
              }}
            />
        </>
    );
};
