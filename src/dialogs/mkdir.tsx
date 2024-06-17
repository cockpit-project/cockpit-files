import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Modal, ModalVariant } from "@patternfly/react-core/dist/esm/components/Modal";
import { Stack } from "@patternfly/react-core/dist/esm/layouts/Stack";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";

import cockpit from 'cockpit';
import { useDialogs } from 'dialogs';
import { InlineNotification } from 'cockpit-components-inline-notification';
import { FormHelper } from 'cockpit-components-form-helper';
import { superuser } from 'superuser';

import { useId, get_owner_candidates } from '../ownership';
import { useFilesContext } from '../app';

const _ = cockpit.gettext;

function check_name(candidate: string) {
    if (candidate === "") {
        return _("Directory name cannot be empty.");
    } else if (candidate.length >= 256) {
        return _("Directory name too long.");
    } else if (candidate.includes("/")) {
        return _("Directory name cannot include a /.");
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

export const CreateDirectoryModal = ({ currentPath }: { currentPath: string }) => {
    const Dialogs = useDialogs();
    const [name, setName] = useState("");
    const [nameError, setNameError] = useState<string | undefined>();
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [owner, setOwner] = useState<string | undefined>();
    const createDirectory = () => {
        const path = currentPath + name;
        create_directory(path, owner).then(Dialogs.close, err => setErrorMessage(err.message));
    };
    const id = useId();
    const { cwdInfo } = useFilesContext();

    const candidates = [];
    if (superuser.allowed && id && cwdInfo) {
        candidates.push(...get_owner_candidates(id, cwdInfo));
        if (owner === undefined) {
            setOwner(candidates[0]);
        }
    }

    return (
        <Modal
          position="top"
          title={_("Create directory")}
          isOpen
          onClose={Dialogs.close}
          variant={ModalVariant.small}
          footer={
              <>
                  <Button
                    variant="primary"
                    onClick={createDirectory}
                    isDisabled={errorMessage !== undefined ||
                        nameError !== undefined ||
                        id === null ||
                        cwdInfo === null}
                  >
                      {_("Create")}
                  </Button>
                  <Button variant="link" onClick={Dialogs.close}>{_("Cancel")}</Button>
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
