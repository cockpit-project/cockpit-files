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

import React from 'react';

import { Alert, AlertActionLink } from '@patternfly/react-core/dist/esm/components/Alert';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Modal, ModalVariant } from '@patternfly/react-core/dist/esm/components/Modal';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea';
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';

import cockpit from 'cockpit';
import type { Dialogs, DialogResult } from 'dialogs';
import { EventEmitter } from 'event';

import "./editor.scss";

const _ = cockpit.gettext;

class EditorState {
    error: string | null = null; // if there is an error to show
    modified: boolean = false; // if there are unsaved changes
    saving: boolean = false; // saving in progress?
    tag_at_load: string | null = null; // the one we loaded
    tag_now: string | null = null; // the one on disk
    content: string = '';
    writable: boolean = false;
}

class Editor extends EventEmitter<{ updated(state: EditorState): void }> {
    file: cockpit.FileHandle<string>;
    state: EditorState;

    update(updates: Partial<EditorState>) {
        Object.assign(this.state, updates);
        this.emit('updated', { ...this.state });
    }

    modify(content: string) {
        this.update({ content, modified: true });
    }

    load_file() {
        // Can't do this async because we can't get the tag via await
        this.file.read()
                .then(((content: string, tag: string) => {
                    this.update({ content, tag_now: tag, tag_at_load: tag });
                }) as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)
                .catch(error => {
                    this.update({ error: cockpit.message(error) });
                });
    }

    constructor(filename: string) {
        super();
        this.file = cockpit.file(filename);
        this.state = new EditorState();

        this.load_file();

        cockpit.spawn(['test', '-w', filename])
                .then(() => this.update({ writable: true }))
                .catch(() => this.update({ writable: false }));

        this.file.watch((_content, tag_now) => {
            this.update({ tag_now });
        }, { read: false });
    }

    async save() {
        if (!this.state.tag_now)
            return;

        try {
            this.update({ saving: true });
            const tag = await this.file.replace(this.state.content, this.state.tag_now);
            this.update({ saving: false, modified: false, tag_now: tag, tag_at_load: tag });
        } catch (exc: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
            this.update({ error: cockpit.message(exc), saving: false });
        }
    }

    close() {
        this.file.close();
    }
}

export const EditFileModal = ({ dialogResult, path } : {
    dialogResult: DialogResult<void>,
    path: string
}) => {
    const [state, setState] = React.useState(new EditorState());
    const [editor, setEditor] = React.useState<Editor | null>(null);

    React.useEffect(() => {
        const editor = new Editor(path);
        editor.on('updated', setState);
        setEditor(editor);
        return () => {
            editor.close();
        };
    }, [path]);

    const modified = state.modified;
    React.useEffect(() => {
        const before_unload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        if (modified) {
            window.addEventListener('beforeunload', before_unload);
            return () => {
                window.removeEventListener('beforeunload', before_unload);
            };
        }
    }, [modified]);

    /* Translators: $0 represents a filename */
    const title = cockpit.format(state?.writable ? _("Editing “$0”") : _("Viewing “$0”"), path);

    return (
        <Modal
          position="top"
          title={title}
          isOpen
          onClose={() => dialogResult.resolve()}
          variant={ModalVariant.large}
          className={`file-editor-modal ${modified ? 'is-modified' : ''}`}
          footer={
              state?.writable &&
              <>
                  <Button
                    variant="primary"
                    isDisabled={
                        !editor ||
                            state.saving ||
                            !modified ||
                            !state.writable ||
                            state.tag_now !== state.tag_at_load
                    }
                    onClick={() => editor && editor.save()}
                  >
                      {_("Save")}
                  </Button>
                  <Button variant="link" onClick={() => dialogResult.resolve()}>
                      {modified ? _("Cancel") : _("Close")}
                  </Button>
              </>
          }
        >
            <Stack>
                {state.error !== null &&
                <Alert
                  type="danger"
                  title={state.error}
                  isInline
                />}
                {state.tag_now !== state.tag_at_load &&
                <Alert
                  isInline
                  variant="warning"
                  title="The file has changed on disk"
                  actionLinks={
                      <>
                          <AlertActionLink onClick={() => editor && editor.load_file()}>
                              {_("Reload file (abandon our changes)")}
                          </AlertActionLink>
                          <AlertActionLink onClick={() => editor && editor.save()}>
                              {_("Overwrite with our changes")}
                          </AlertActionLink>
                      </>
                  }
                />}
                <TextArea
                  id='editor-text-area'
                  className='file-editor'
                  isDisabled={!state.writable}
                  value={state.content}
                  onChange={(_ev, content) => editor && editor.modify(content)}
                />
            </Stack>
        </Modal>
    );
};

export function edit_file(dialogs: Dialogs, path: string) {
    dialogs.run(EditFileModal, { path });
}
