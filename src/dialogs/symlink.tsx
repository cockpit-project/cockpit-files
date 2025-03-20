/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2025 Red Hat, Inc.
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
import React from 'react';

import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { Modal, ModalVariant } from '@patternfly/react-core/dist/esm/components/Modal';
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
import { useInit } from 'hooks.ts';
import { superuser } from 'superuser';
import { fmt_to_fragments } from "utils";

import { useFilesContext, type FolderFileInfo } from '../common.ts';
import { get_owner_candidates } from '../ownership.tsx';

function checkLinkName(candidate: string, entries: Record<string, FileInfo>, selectedFile?: FolderFileInfo) {
    if (candidate === "") {
        return _("Name cannot be empty");
    } else if (candidate.length >= 256) {
        return _("Name too long");
    } else if (selectedFile && selectedFile.name === candidate) {
        return _("Filename is the same as original name");
    } else if (candidate in entries) {
        if (entries[candidate].type === "dir") {
            return _("Directory with the same name exists");
        }
        return _("File exists");
    } else {
        return null;
    }
}

const _ = cockpit.gettext;

type symlink_mode = "absolute" | "relative";

const CreateLinkModal = ({ dialogResult, path, selected } : {
    dialogResult: DialogResult<void>
    path: string,
    selected: FolderFileInfo,
}) => {
    const [errorMessage, setErrorMessage] = React.useState<string | undefined>();
    const [symlinkName, setSymlinkName] = React.useState<string>(cockpit.format(_("link to $0"), selected.name));
    const [symlinkError, setSymlinkError] = React.useState<string | null>(null);
    const [mode, setMode] = React.useState<symlink_mode>("absolute");
    const [user, setUser] = React.useState<cockpit.UserInfo| undefined>();

    const { cwdInfo } = useFilesContext();

    useInit(() => {
        cockpit.user().then(user => setUser(user));
    });

    const createLink = async () => {
        cockpit.assert(user !== undefined);
        cockpit.assert(cwdInfo !== null);

        const cmd = ["ln", "--symbolic"];
        const target = `${path}${selected.name}`;
        let owner = null;

        let symlinkPath = symlinkName;
        if (symlinkName.startsWith('..')) {
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

        if (mode === "absolute") {
            if (symlinkName.startsWith('/')) {
                try {
                    const realpath = await cockpit.spawn(["realpath", symlinkName]);
                    cmd.push(target, realpath.trimEnd());
                } catch (exc) {
                    const err = exc as BasicError;
                    setErrorMessage(err.toString());
                    return;
                }
            } else if (symlinkName.startsWith('..')) {
                cmd.push(target, symlinkPath);
            } else {
                cmd.push(target, symlinkName);
            }
        } else if (mode === "relative") {
            cmd.push("--relative", target, symlinkName);
        }

        if (superuser.allowed) {
            owner = [...get_owner_candidates(user, folder_info)][0];
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

    return (
        <Modal
          position="top"
          title={fmt_to_fragments(_("Create link to $0"), <b>{selected.name}</b>)}
          variant={ModalVariant.medium}
          isOpen
          className="file-symlink-modal"
          onClose={() => dialogResult.resolve()}
          footer={
              <>
                  <Button
                    variant="primary"
                    onClick={() => {
                        const filename_invalid = checkLinkName(symlinkName, cwdInfo?.entries || {}, selected);
                        if (filename_invalid) {
                            setSymlinkError(filename_invalid);
                        } else {
                            createLink();
                        }
                    }}
                    isDisabled={errorMessage !== undefined ||
                        symlinkError !== null ||
                        cwdInfo === null ||
                        user === null}
                  >
                      {_("Create link")}
                  </Button>
                  <Button variant="link" onClick={() => dialogResult.resolve()}>{_("Cancel")}</Button>
              </>
          }
        >
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
                          const filename_invalid = checkLinkName(val, cwdInfo?.entries || {}, selected);
                          setSymlinkError(filename_invalid);
                          setErrorMessage(undefined);
                          setSymlinkName(val);
                      }}
                      onFocus={(event) => event.target.setSelectionRange(0, cockpit.format(_("link to $0"), "").length)}
                      id="symlink-input" autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                    />
                    <FormHelper fieldId="symlink-input" helperTextInvalid={symlinkError} />
                </FormGroup>
                <FormGroup
                  fieldId="symlink-type"
                  label={_("Type")}
                  isInline
                  labelIcon={
                      <Popover
                        headerContent={_("Absolute vs. Relative")}
                        bodyContent={
                            <>
                                {/* eslint-disable-next-line max-len */}
                                <p>{_("Absolute symlinks are ideal when referring to files or directories that won't move, such as system files.")}</p>
                                <br />
                                {/* eslint-disable-next-line max-len */}
                                <p>{_("Relative symlinks use a shorter local path to a target. This is useful when both a symlink and target might move at the same time, such as when renaming or moving a parent directory.")}</p>
                            </>
                        }
                      >
                          <Button
                            isInline
                            variant="plain"
                            onClick={e => e.preventDefault()}
                          >
                              <HelpIcon />
                          </Button>
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
        </Modal>
    );
};

export function create_link(dialogs: Dialogs, path: string, selected: FolderFileInfo) {
    dialogs.run(CreateLinkModal, { path, selected });
}
