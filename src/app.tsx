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
import { superuser } from "superuser";
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
    Page, PageSection,
    Sidebar, SidebarPanel, SidebarContent,
    AlertGroup, Alert, AlertVariant, AlertActionCloseButton
} from "@patternfly/react-core";
import { ExclamationCircleIcon } from "@patternfly/react-icons";

import { WithDialogs } from "dialogs.jsx";
import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { FilesBreadcrumbs } from "./files-breadcrumbs";
import { SidebarPanelDetails } from "./sidebar.jsx";
import { FilesFolderView } from "./files-folder-view";
import { usePageLocation } from "hooks.js";
import { fsinfo, FileInfo } from "./fsinfo";

superuser.reload_page_on_change();

interface Alert {
    key: string,
    title: string,
    variant: AlertVariant,
}

export interface FolderFileInfo extends FileInfo {
    name: string,
    to: string | null,
}

interface FilesContextType {
    addAlert: (title: string, variant: AlertVariant, key: string) => void,
    cwdInfo: FileInfo | null,
}

export const FilesContext = React.createContext({
    addAlert: () => console.warn("FilesContext not initialized"),
    cwdInfo: null,
} as FilesContextType);

export const useFilesContext = () => useContext(FilesContext);

export const Application = () => {
    const { options } = usePageLocation();
    const [loading, setLoading] = useState(true);
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [files, setFiles] = useState<FolderFileInfo[]>([]);
    const [selected, setSelected] = useState<FolderFileInfo[]>([]);
    const [showHidden, setShowHidden] = useState(localStorage.getItem("files:showHiddenFiles") === "true");
    const [clipboard, setClipboard] = useState<string[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [cwdInfo, setCwdInfo] = useState<FileInfo | null>(null);

    const currentPath = decodeURIComponent(options.path?.toString() || "");
    // the function itself is not expensive, but `path` is later used in expensive computation
    // and changing its reference value on every render causes performance issues
    const path = useMemo(() => currentPath?.split("/"), [currentPath]);

    useEffect(() => {
        cockpit.user().then(user => {
            if (options.path === undefined) {
                cockpit.location.replace("/", { path: encodeURIComponent(user.home) });
            }
        });
    }, [options]);

    useEffect(
        () => {
            if (options.path === undefined) {
                return;
            }

            const info = fsinfo(
                `/${currentPath}`,
                ["type", "mode", "size", "mtime", "user", "group", "target", "entries", "targets"]
            );
            return info.effect(state => {
                setLoading(false);
                setLoadingFiles(!(state.info || state.error));
                setCwdInfo(state.info);
                setErrorMessage(state.error?.message ?? "");
                const entries = Object.entries(state?.info?.entries || {});
                const files = entries.map(([name, attrs]) => ({
                    ...attrs,
                    name,
                    to: info.target(name)?.type ?? null
                }));
                setFiles(files);
            });
        },
        [options, currentPath]
    );

    if (loading)
        return <EmptyStatePanel loading />;

    const addAlert = (title: string, variant: AlertVariant, key: string) => {
        setAlerts(prevAlerts => [...prevAlerts, { title, variant, key }]);
    };
    const removeAlert = (key: string) => setAlerts(prevAlerts => [...prevAlerts.filter(alert => alert.key !== key)]);

    return (
        <Page>
            <FilesContext.Provider value={{ addAlert, cwdInfo }}>
                <WithDialogs>
                    <AlertGroup isToast isLiveRegion>
                        {alerts.map(alert => (
                            <Alert
                              variant={alert.variant}
                              title={alert.title}
                              actionClose={
                                  <AlertActionCloseButton
                                    title={alert.title}
                                    variantLabel={`${alert.variant} alert`}
                                    onClose={() => removeAlert(alert.key)}
                                  />
                              }
                              key={alert.key}
                            />
                        ))}
                    </AlertGroup>
                    <FilesBreadcrumbs
                      path={path}
                      showHidden={showHidden} setShowHidden={setShowHidden}
                    />
                    <PageSection>
                        <Sidebar isPanelRight hasGutter>
                            <SidebarContent>
                                {errorMessage &&
                                <EmptyStatePanel
                                  paragraph={errorMessage}
                                  icon={ExclamationCircleIcon}
                                />}
                                {!errorMessage &&
                                <FilesFolderView
                                  path={path}
                                  files={files}
                                  loadingFiles={loadingFiles}
                                  showHidden={showHidden}
                                  selected={selected}
                                  setSelected={setSelected}
                                  clipboard={clipboard}
                                  setClipboard={setClipboard}
                                />}
                            </SidebarContent>
                            <SidebarPanel className="sidebar-panel" width={{ default: "width_25" }}>
                                <SidebarPanelDetails
                                  path={path}
                                  selected={selected.map(s => files.find(f => f.name === s.name))
                                          .filter(s => s !== undefined)}
                                  showHidden={showHidden} setSelected={setSelected}
                                  clipboard={clipboard} setClipboard={setClipboard}
                                  files={files}
                                />
                            </SidebarPanel>
                        </Sidebar>
                    </PageSection>
                </WithDialogs>
            </FilesContext.Provider>
        </Page>
    );
};
