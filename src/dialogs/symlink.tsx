/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2025 Red Hat, Inc.
 */
import React from 'react';

import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import {
    Modal, ModalBody, ModalFooter, ModalHeader, ModalVariant
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Popover } from "@patternfly/react-core/dist/esm/components/Popover";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { HelpIcon } from "@patternfly/react-icons";

import cockpit, { BasicError } from 'cockpit';
import { fsinfo, type FileInfo } from 'cockpit/fsinfo.ts';
import { FormHelper } from 'cockpit-components-form-helper';
import { InlineNotification } from 'cockpit-components-inline-notification';
import { dirname } from 'cockpit-path.ts';
import type { Dialogs, DialogResult } from 'dialogs';
import { superuser } from 'superuser';
import { fmt_to_fragments } from "utils";

import { useFilesContext, type FolderFileInfo } from '../common.ts';
import { get_owner_candidates } from '../ownership.tsx';

const _ = cockpit.gettext;

type symlink_mode = "absolute" | "relative";

function checkLinkName(candidate: string, entries: Record<string, FileInfo>) {
    if (candidate === "") {
        return _("Name cannot be empty");
    } else if (candidate in entries) {
        if (entries[candidate].type === "dir") {
            return _("Directory with the same name exists");
        }
        return _("File exists");
    } else {
        return null;
    }
}

const CreateLinkModal = ({ dialogResult, path, selected } : {
    dialogResult: DialogResult<void>
    path: string,
    selected: FolderFileInfo,
}) => {
    const [errorMessage, setErrorMessage] = React.useState<string | undefined>();
    const [symlinkName, setSymlinkName] = React.useState<string>(cockpit.format(_("link to $0"), selected.name));
    const [symlinkError, setSymlinkError] = React.useState<string | null>(null);
    const [mode, setMode] = React.useState<symlink_mode>("relative");

    const { cwdInfo } = useFilesContext();

    const createLink = async () => {
        cockpit.assert(cwdInfo !== null);

        const cmd = ["ln", "--symbolic", "--no-target-directory"];
        const target = `${path}${selected.name}`;
        let symlinkPath = symlinkName;
        let owner = null;

        // for non-absolute paths obtain the absolute path
        if (!symlinkPath.startsWith('/')) {
            try {
                symlinkPath = await cockpit.spawn(["realpath", `${path}${symlinkName}`], { superuser: "try" });
                symlinkPath = symlinkPath.trim();
            } catch (exc) {
                const err = exc as BasicError;
                setErrorMessage(err.toString());
                console.warn("unable to obtain realpath", exc);
                return;
            }
        }

        let folder_info = cwdInfo;
        // If the path is not in the current directory obtain the user/group/mode
        if (symlinkName.startsWith('/') || symlinkName.startsWith('..')) {
            try {
                folder_info = await fsinfo(dirname(symlinkPath), ["user", "group", "mode"], { superuser: "try" });
            } catch (exc) {
                const err = exc as BasicError;
                setErrorMessage(err.toString());
                console.warn(`fsinfo failed for ${symlinkPath}`, exc);
                return;
            }
        }

        if (mode === "relative") {
            cmd.push("--relative");
        }

        cmd.push(target, symlinkPath);

        if (superuser.allowed) {
            owner = [...get_owner_candidates(folder_info)][0];
        }

        try {
            await cockpit.spawn(cmd, {
                err: "message",
                directory: path,
                ...owner && { superuser: "require" }
            });

            if (owner !== null) {
                await cockpit.spawn(["chown", "--no-dereference", owner, symlinkName], {
                    directory: path,
                    superuser: "require"
                });
            }
        } catch (exc) {
            const err = exc as BasicError;
            setErrorMessage(err.toString());
            return;
        }

        dialogResult.resolve();
    };

    const modalHeader = (
        <ModalHeader
          title={
              fmt_to_fragments(_("Create link to $0"), <b className="ct-heading-font-weight">{selected.name}</b>)
          }
        />
    );

    return (
        <Modal
          position="top"
          variant={ModalVariant.medium}
          isOpen
          className="file-symlink-modal"
          onClose={() => dialogResult.resolve()}
        >
            {modalHeader}
            <ModalBody>
                {errorMessage &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                />}
                <Form
                  isHorizontal
                  onSubmit={e => {
                      e.preventDefault();
                      createLink();
                      return false;
                  }}
                >
                    <FormGroup fieldId="target-name" label={_("Target")}>
                        <TextInput
                          value={selected.name}
                          readOnlyVariant="plain"
                          id="target-name"
                        />
                    </FormGroup>
                    <FormGroup fieldId="symlink-input" label={_("Symlink name")}>
                        <TextInput
                          validated={symlinkError ? "error" : "default"}
                          value={symlinkName}
                          onChange={(_, val) => {
                              const filename_invalid = checkLinkName(val, cwdInfo?.entries || {});
                              setSymlinkError(filename_invalid);
                              setErrorMessage(undefined);
                              setSymlinkName(val);
                          }}
                          id="symlink-input" autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                        />
                        <FormHelper fieldId="symlink-input" helperTextInvalid={symlinkError} />
                    </FormGroup>
                    <FormGroup
                      fieldId="symlink-type"
                      label={_("Type")}
                      isInline
                      labelHelp={
                          <Popover
                            headerContent={_("Absolute vs. Relative")}
                            bodyContent={
                                <>
                                    {/* eslint-disable-next-line max-len */}
                                    <p>{_("Absolute symlinks are ideal when referring to files or directories that won't move, such as system files.")}</p>
                                    <br />
                                    {/* eslint-disable-next-line max-len */}
                                    <p>{_("Relative symlinks are useful when both a symlink and target might move at the same time, such as when renaming or moving a parent directory.")}</p>
                                </>
                            }
                          >
                              <HelpIcon />
                          </Popover>
                      }
                    >
                        <Radio
                          id="absolute"
                          name="absolute"
                          label={_("Absolute")}
                          isChecked={mode === "absolute"}
                          onChange={() => setMode("absolute")}
                        />
                        <Radio
                          id="relative"
                          name="relative"
                          label={_("Relative")}
                          isChecked={mode === "relative"}
                          onChange={() => setMode("relative")}
                        />
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                  variant="primary"
                  onClick={() => {
                      const filename_invalid = checkLinkName(symlinkName, cwdInfo?.entries || {});
                      if (filename_invalid) {
                          setSymlinkError(filename_invalid);
                      } else {
                          createLink();
                      }
                  }}
                  isDisabled={errorMessage !== undefined ||
                      symlinkError !== null ||
                      cwdInfo === null}
                >
                    {_("Create link")}
                </Button>
                <Button variant="link" onClick={() => dialogResult.resolve()}>{_("Cancel")}</Button>
            </ModalFooter>
        </Modal>
    );
};

export function create_link(dialogs: Dialogs, path: string, selected: FolderFileInfo) {
    dialogs.run(CreateLinkModal, { path, selected });
}
