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
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { Modal, ModalVariant } from '@patternfly/react-core/dist/esm/components/Modal';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea';
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { debounce } from "throttle-debounce";

import cockpit from 'cockpit';
import { EventEmitter } from 'cockpit/event.ts';
import type { Dialogs, DialogResult } from 'dialogs';
import { fmt_to_fragments } from 'utils';

import "./editor.scss";

const _ = cockpit.gettext;

// 1MB
export const MAX_EDITOR_FILE_SIZE = 1000000;

class EditorState {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    error: any | null = null; // if there is an error to show
    modified: boolean = false; // if there are unsaved changes
    saving: boolean = false; // saving in progress?
    tag_at_load: string | null = null; // the one we loaded
    tag_now: string | null = null; // the one on disk
    content: string = '';
    writable: boolean = false;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function translate_error(error: any) {
    if (error.problem === "not-found") {
        return _("The file has been removed on disk");
    } else if (error?.problem === 'change-conflict') {
        return _("The existing file changed unexpectedly");
    } else {
        return cockpit.message(error);
    }
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
                    this.update({ content, tag_now: tag, tag_at_load: tag, error: null });
                }) as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)
                .catch(error => this.update({ error }));
    }

    constructor(filename: string) {
        super();
        this.file = cockpit.file(filename, { max_read_size: MAX_EDITOR_FILE_SIZE, superuser: "try" });
        this.state = new EditorState();

        this.load_file();

        cockpit.spawn(['test', '-w', filename], { superuser: "try" })
                .then(() => this.update({ writable: true }))
                .catch(() => this.update({ writable: false }));

        const handle_watch = debounce(500, (_content: string | null, tag_now: string | null) => {
            this.update({ tag_now });
        });

        this.file.watch(handle_watch, { read: false });
    }

    async save() {
        if (!this.state.tag_now) {
            console.error("Unable to save as 'tag_now' is not initialised");
            return;
        }

        try {
            const content = this.state.content;
            const content_with_nl = content && !content.endsWith('\n') ? content + '\n' : content;

            this.update({ saving: true });
            const tag = await this.file.replace(content_with_nl, this.state.tag_now);
            this.update({ saving: false, modified: false, tag_now: tag, tag_at_load: tag });
        } catch (exc: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
            this.update({ error: exc, saving: false });
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
    const [last_tag, setLastTag] = React.useState<string | null>(null);
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

    const { modified } = state;
    React.useEffect(() => {
        const before_unload = (event: BeforeUnloadEvent) => {
            event.preventDefault();

            // Included for legacy support, e.g. Chrome/Edge < 119
            event.returnValue = true;
        };
        if (modified) {
            window.addEventListener('beforeunload', before_unload);
            return () => {
                window.removeEventListener('beforeunload', before_unload);
            };
        }
    }, [modified]);

    const handleEscape = (event: KeyboardEvent) => {
        if (state?.modified) {
            event.preventDefault();
        } else {
            dialogResult.resolve();
        }
    };

    /* Translators: This is the title of a modal dialog.  $0 represents a filename. */
    let title = <>{fmt_to_fragments(state?.writable ? _("Edit $0") : _("View $0"), <b>{path}</b>)}</>;
    if (!state.writable) {
        // TODO: dark mode and lack of spacing
        title = (<>{title}<Label className="file-editor-title-label" variant="filled">{_("Read-only")}</Label></>);
    }

    // File has changed on disk while editing.
    const change_conflict = state.tag_now !== state.tag_at_load;
    const file_removed = state.tag_now === "-";

    return (
        <Modal
          position="top"
          title={title}
          isOpen
          onClose={() => dialogResult.resolve()}
          variant={ModalVariant.large}
          className={`file-editor-modal ${modified ? 'is-modified' : ''}`}
          onEscapePress={handleEscape}
          footer={
              <>
                  {change_conflict && !file_removed &&
                  <Button
                    variant="warning"
                    onClick={() => editor && editor.save()}
                  >
                      {_("Overwrite")}
                  </Button>}
                  {state?.writable && (!change_conflict || file_removed) &&
                  <Button
                    variant="primary"
                    isDisabled={
                        !editor ||
                            state.saving ||
                            !modified ||
                            !state.writable
                    }
                    onClick={() => editor && editor.save()}
                  >
                      {_("Save")}
                  </Button>}
                  <Button variant={state.writable ? "link" : "secondary"} onClick={() => dialogResult.resolve()}>
                      {modified ? _("Cancel") : _("Close")}
                  </Button>
              </>
          }
        >
            <Stack>
                {state.tag_now === state.tag_at_load && state.error !== null &&
                <Alert
                  className="file-editor-alert"
                  variant="danger"
                  title={translate_error(state.error)}
                  isInline
                />}
                {state.tag_now !== state.tag_at_load && last_tag !== state.tag_now &&
                <Alert
                  className="file-editor-alert"
                  isInline
                  variant="warning"
                  title={file_removed
                      ? _("The file has been removed on disk")
                      : _("The file has changed on disk")}
                  actionLinks={
                      <>
                          {!file_removed &&
                          <AlertActionLink onClick={() => editor && editor.load_file()}>
                              {_("Reload")}
                          </AlertActionLink>}
                          <AlertActionLink onClick={() => setLastTag(state.tag_now)}>
                              {_("Ignore")}
                          </AlertActionLink>
                      </>
                  }
                />}
                <TextArea
                  id="editor-text-area"
                  className="file-editor"
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
