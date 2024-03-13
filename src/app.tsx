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
import React, { useEffect, useMemo, useState } from "react";
import {
    Card,
    Page, PageSection,
    Sidebar, SidebarPanel, SidebarContent,
    AlertGroup, Alert, AlertVariant, AlertActionCloseButton
} from "@patternfly/react-core";
import { ExclamationCircleIcon } from "@patternfly/react-icons";

import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { NavigatorBreadcrumbs } from "./navigator-breadcrumbs";
import { NavigatorCardBody } from "./navigator-card-body.jsx";
import { SidebarPanelDetails } from "./sidebar.jsx";
import { NavigatorCardHeader } from "./header.jsx";
import { usePageLocation } from "hooks.js";
import { fsinfo, FileInfo } from "./fsinfo";

superuser.reload_page_on_change();

interface Alert {
    key: string,
    title: string,
    variant: AlertVariant,
}

interface NavigatorFileInfo extends FileInfo {
    name: string,
    to: string | null,
}

export const Application = () => {
    const { options } = usePageLocation();
    const [loading, setLoading] = useState(true);
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [currentFilter, setCurrentFilter] = useState("");
    const [files, setFiles] = useState<NavigatorFileInfo[]>([]);
    // eslint-disable-next-line no-unused-vars
    const [rootInfo, setRootInfo] = useState<FileInfo | null>();
    const [isGrid, setIsGrid] = useState(true);
    const [sortBy, setSortBy] = useState(localStorage.getItem("cockpit-navigator.sort") || "az");
    const [selected, setSelected] = useState<NavigatorFileInfo[]>([]);
    const [showHidden, setShowHidden] = useState(localStorage.getItem("cockpit-navigator.showHiddenFiles") === "true");
    const [clipboard, setClipboard] = useState([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);

    const onFilterChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => setCurrentFilter(value);
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
                setRootInfo(state.info);
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
            <NavigatorBreadcrumbs
              path={path}
              showHidden={showHidden} setShowHidden={setShowHidden}
            />
            <PageSection>
                <Sidebar isPanelRight hasGutter>
                    <SidebarContent>
                        <Card>
                            <NavigatorCardHeader
                              currentFilter={currentFilter}
                              onFilterChange={onFilterChange}
                              isGrid={isGrid}
                              setIsGrid={setIsGrid}
                              sortBy={sortBy}
                              setSortBy={setSortBy}
                            />
                            {errorMessage && <EmptyStatePanel paragraph={errorMessage} icon={ExclamationCircleIcon} />}
                            <NavigatorCardBody
                              files={files}
                              currentFilter={currentFilter}
                              path={path}
                              isGrid={isGrid}
                              sortBy={sortBy}
                              selected={selected}
                              setSelected={setSelected}
                              loadingFiles={loadingFiles}
                              clipboard={clipboard}
                              setClipboard={setClipboard}
                              addAlert={addAlert}
                              showHidden={showHidden}
                            />
                        </Card>
                    </SidebarContent>
                    <SidebarPanel className="sidebar-panel" width={{ default: "width_25" }}>
                        <SidebarPanelDetails
                          path={path}
                          selected={selected.map(s => files.find(f => f.name === s.name)).filter(s => s !== undefined)}
                          showHidden={showHidden} setSelected={setSelected}
                          clipboard={clipboard} setClipboard={setClipboard}
                          files={files} addAlert={addAlert}
                        />
                    </SidebarPanel>
                </Sidebar>
            </PageSection>
        </Page>
    );
};
