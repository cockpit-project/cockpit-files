/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2024 Red Hat, Inc.
 */

import React from 'react';

import { Alert, AlertActionLink } from '@patternfly/react-core/dist/esm/components/Alert';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import {
    Modal, ModalBody, ModalFooter, ModalHeader, ModalVariant
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea';
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { TrashIcon } from '@patternfly/react-icons';
import { debounce } from "throttle-debounce";

import cockpit from 'cockpit';
import { EventEmitter } from 'cockpit/event.ts';
import { basename } from "cockpit-path";
import type { Dialogs, DialogResult } from 'dialogs';
import { fmt_to_fragments } from 'utils';

import "./editor.css";

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
    const [confirmDiscardDialog, setConfirmDiscardDialog] = React.useState(false);
    const confirmDiscardRef = React.useRef(confirmDiscardDialog);
    const editorRef = React.useRef<Editor | null>(null);

    React.useEffect(() => {
        const editor = new Editor(path);
        editor.on('updated', setState);
        editorRef.current = editor;
        return () => {
            editor.close();
        };
    }, [path]);

    React.useEffect(() => {
        confirmDiscardRef.current = confirmDiscardDialog;
    }, [confirmDiscardDialog]);

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

    const closeConfirm = React.useCallback(() => {
        if (state?.modified) {
            setConfirmDiscardDialog(true);
        } else {
            dialogResult.resolve();
        }
    }, [state, dialogResult]);

    const saveThenClose = React.useCallback(async () => {
        if (!editorRef.current) return;
        await editorRef.current.save();
        dialogResult.resolve();
    }, [dialogResult]);

    const handleEscape = (event: KeyboardEvent) => {
        if (state?.modified) {
            event.preventDefault();
        }
        // Use a timeout here otherwise the escape press handler of the confirm dialog runs aswell
        setTimeout(closeConfirm, 0);
    };

    React.useEffect(() => {
        const onKeyDown = function (event: KeyboardEvent) {
            if (confirmDiscardRef.current) {
                if (event.key === "s" || event.key === "S" || event.key === "Enter") {
                    saveThenClose();
                } else if (event.key === "n" || event.key === "N") {
                    dialogResult.resolve();
                } else if (event.key === "c" || event.key === "C") {
                    setConfirmDiscardDialog(false);
                }
            } else {
                if ((event.ctrlKey || event.metaKey) && (event.key === "s" || event.key === "S")) {
                    event.preventDefault();
                    if (editorRef.current) editorRef.current.save();
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [dialogResult, saveThenClose]);

    const boldBasename = (<b className="ct-heading-font-weight">{basename(path)}</b>);
    /* Translators: This is the title of a modal dialog.  $0 represents a filename. */
    let title = <>{fmt_to_fragments(state?.writable ? _("Edit $0") : _("View $0"), boldBasename)}</>;
    if (!state.writable) {
        title = (<>{title}<Label className="file-editor-title-label" variant="filled">{_("Read-only")}</Label></>);
    }

    // File has changed on disk while editing.
    const change_conflict = state.tag_now !== state.tag_at_load;
    const file_removed = state.tag_now === "-";

    return (
        <>
            <Modal
              position="top"
              isOpen={!confirmDiscardDialog}
              onClose={() => closeConfirm()}
              variant={ModalVariant.large}
              className={`file-editor-modal ${modified ? 'is-modified' : ''}`}
              onEscapePress={handleEscape}
            >
                <ModalHeader title={title} />
                <ModalBody>
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
                                  <AlertActionLink onClick={() => editorRef.current && editorRef.current.load_file()}>
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
                          onChange={(_ev, content) => editorRef.current && editorRef.current.modify(content)}
                        />
                    </Stack>
                </ModalBody>
                <ModalFooter>
                    {change_conflict && !file_removed &&
                    <Button
                      variant="warning"
                      onClick={() => editorRef.current && editorRef.current.save()}
                    >
                        {_("Overwrite")}
                    </Button>}
                    {state?.writable && (!change_conflict || file_removed) &&
                    <Button
                      variant="primary"
                      isDisabled={
                          !editorRef.current ||
                          state.saving ||
                          !modified ||
                          !state.writable
                      }
                      onClick={() => editorRef.current && editorRef.current.save()}
                    >
                        {_("Save")}
                    </Button>}
                    <Button variant={state.writable ? "link" : "secondary"} onClick={() => closeConfirm()}>
                        {modified ? _("Cancel") : _("Close")}
                    </Button>
                </ModalFooter>
            </Modal>
            <Modal
              variant={ModalVariant.small}
              isOpen={confirmDiscardDialog}
              onClose={() => setConfirmDiscardDialog(false)}
              onEscapePress={() => setConfirmDiscardDialog(false)}
            >
                <ModalHeader titleIconVariant={TrashIcon} title={_("Save changes?")} />
                <ModalBody id="modal-box-body-basic">
                    {fmt_to_fragments(
                        _("$0 has unsaved changes and which will be permanently lost if discarded.")
                        , boldBasename
                    )}
                    {change_conflict && !file_removed &&
                    <Alert
                      className="file-editor-alert"
                      isInline
                      variant="warning"
                      title={file_removed
                          ? _("The file has changed on disk between when it was opened and now")
                          : _("The file was deleted after it was opened, saving will recreate it.")}
                    />}
                </ModalBody>
                <ModalFooter>
                    {change_conflict && !file_removed &&
                    <Button
                      variant="warning"
                      onClick={() => saveThenClose()}
                    >
                        {_("Overwrite")}
                    </Button>}
                    {state?.writable && (!change_conflict || file_removed) &&
                    <Button
                      variant="primary"
                      isDisabled={
                          !editorRef.current ||
                          state.saving ||
                          !modified ||
                          !state.writable
                      }
                      onClick={() => saveThenClose()}
                    >
                        {_("Save")}
                    </Button>}
                    <Button
                      key="discard" variant="secondary"
                      isDanger isDisabled={state.saving}
                      onClick={() => dialogResult.resolve()}
                    >
                        {_("Discard")}
                    </Button>
                    <Button
                      key="cancel" variant="link"
                      isDisabled={state.saving} onClick={() => setConfirmDiscardDialog(false)}
                    >
                        {_("Cancel")}
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
};

export function edit_file(dialogs: Dialogs, path: string) {
    dialogs.run(EditFileModal, { path });
}
