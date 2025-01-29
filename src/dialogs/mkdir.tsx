/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2024 Red Hat, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import React, { useEffect, useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Modal, ModalVariant } from "@patternfly/react-core/dist/esm/components/Modal";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Stack } from "@patternfly/react-core/dist/esm/layouts/Stack";

import cockpit from 'cockpit';
import { FormHelper } from 'cockpit-components-form-helper';
import { InlineNotification } from 'cockpit-components-inline-notification';
import type { Dialogs, DialogResult } from 'dialogs';
import { superuser } from 'superuser';

import { useFilesContext } from '../common.ts';
import { get_owner_candidates } from '../ownership.tsx';

const _ = cockpit.gettext;

function check_name(candidate: string) {
    if (candidate === "") {
        return _("Directory name cannot be empty");
    } else if (candidate.length >= 256) {
        return _("Directory name too long");
    } else if (candidate.includes("/")) {
        return _("Directory name cannot include a /");
    } else {
        return undefined;
    }
}

async function create_directory(path: string, owner?: string) {
    if (owner !== undefined) {
        const opts = { err: "message", superuser: "require" } as const;
        await cockpit.spawn(["mkdir", path], opts);
        await cockpit.spawn(["chown", owner, path], opts);
    } else {
        await cockpit.spawn(["mkdir", path], { err: "message" });
    }
}

const CreateDirectoryModal = ({ currentPath, dialogResult } : {
    currentPath: string,
    dialogResult: DialogResult<void>
}) => {
    const [name, setName] = useState("");
    const [nameError, setNameError] = useState<string | undefined>();
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [owner, setOwner] = useState<string | undefined>();
    const [user, setUser] = useState<cockpit.UserInfo| undefined>();
    const createDirectory = () => {
        const path = currentPath + name;
        create_directory(path, owner).then(dialogResult.resolve, err => setErrorMessage(err.message));
    };
    const { cwdInfo } = useFilesContext();

    useEffect(() => {
        cockpit.user().then(user => setUser(user));
    }, []);

    const candidates = [];
    if (superuser.allowed && user && cwdInfo) {
        candidates.push(...get_owner_candidates(user, cwdInfo));
        if (owner === undefined) {
            setOwner(candidates[0]);
        }
    }

    return (
        <Modal
          position="top"
          title={_("Create directory")}
          isOpen
          onClose={() => dialogResult.resolve()}
          variant={ModalVariant.small}
          footer={
              <>
                  <Button
                    variant="primary"
                    onClick={createDirectory}
                    isDisabled={errorMessage !== undefined ||
                        nameError !== undefined ||
                        user === null ||
                        cwdInfo === null}
                  >
                      {_("Create")}
                  </Button>
                  <Button variant="link" onClick={() => dialogResult.resolve()}>{_("Cancel")}</Button>
              </>
          }
        >
            <Stack>
                {errorMessage !== undefined &&
                <InlineNotification
                  type="danger"
                  text={errorMessage}
                  isInline
                />}
                <Form
                  isHorizontal onSubmit={e => {
                      createDirectory();
                      e.preventDefault();
                      return false;
                  }}
                >
                    <FormGroup fieldId="create-directory-input" label={_("Directory name")}>
                        <TextInput
                          validated={nameError ? "error" : "default"}
                          value={name}
                          onChange={(_, val) => {
                              setNameError(check_name(val));
                              setErrorMessage(undefined);
                              setName(val);
                          }}
                          id="create-directory-input" autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                        />
                        <FormHelper fieldId="create-directory-input" helperTextInvalid={nameError} />
                    </FormGroup>
                    {candidates.length > 0 &&
                        <FormGroup fieldId="create-directory-owner" label={_("Directory owner")}>
                            <FormSelect
                              id='create-directory-owner'
                              value={owner}
                              onChange={(_ev, val) => setOwner(val)}
                            >
                                {candidates.map(owner =>
                                    <FormSelectOption
                                      key={owner}
                                      value={owner}
                                      label={owner}
                                    />)}
                            </FormSelect>
                        </FormGroup>}
                </Form>
            </Stack>
        </Modal>
    );
};

export function show_create_directory_dialog(dialogs: Dialogs, currentPath: string) {
    dialogs.run(CreateDirectoryModal, { currentPath });
}
