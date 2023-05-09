/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
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

import cockpit from 'cockpit';
import React from 'react';
import { Breadcrumb, BreadcrumbItem, Button, Flex, FlexItem, Icon, Page, PageBreadcrumb, PageSection } from "@patternfly/react-core";
import { ArrowLeftIcon, ArrowRightIcon, EditAltIcon, FileIcon, FolderIcon, PficonHistoryIcon, StarIcon } from "@patternfly/react-icons";

const _ = cockpit.gettext;

// To do: convert to functional component
export class Application extends React.Component {
    constructor() {
        super();
        this.state = { hostname: _("Unknown"), current_user: "", files: [] };

        cockpit.file('/etc/hostname').watch(content => {
            this.setState({ hostname: content.trim() });
        });
    }

    componentDidMount() {
        cockpit.user().then(user => {
            this.setState({ current_user: user.name || "" });
        })
                .then(() => {
                    cockpit.spawn(["ls", "-p", `/home/${this.state.current_user}`], { superuser: true }).then((res) => {
                        res = res.split("\n");
                        console.log(res.slice(0, res.length - 1));
                        this.setState({ files: res.slice(0, res.length - 1) });
                    });
                });
    }

    // To do: button spacing, correct refresh icon
    render() {
        return (
            <Page>
                <PageBreadcrumb stickyOnBreakpoint={{ default: "top" }}>
                    <Flex>
                        <FlexItem>
                            <Button variant="secondary">
                                <Icon>
                                    <ArrowLeftIcon />
                                </Icon>
                            </Button>
                        </FlexItem>
                        <FlexItem>
                            <Button variant="secondary">
                                <Icon>
                                    <ArrowRightIcon />
                                </Icon>
                            </Button>
                        </FlexItem>
                        <FlexItem>
                            <Button variant="secondary">
                                <Icon>
                                    <PficonHistoryIcon />
                                </Icon>
                            </Button>
                        </FlexItem>
                        <FlexItem>
                            <Breadcrumb>
                                <BreadcrumbItem to="#/">{_("home")}</BreadcrumbItem>
                            </Breadcrumb>
                        </FlexItem>
                        <FlexItem align={{ default: 'alignRight' }}>
                            <Button variant="secondary">
                                <Icon>
                                    <EditAltIcon />
                                </Icon>
                            </Button>
                        </FlexItem>
                        <FlexItem>
                            <Button variant="secondary">
                                <Icon>
                                    <StarIcon />
                                </Icon>
                            </Button>
                        </FlexItem>
                        <FlexItem>
                            {/* To do: Kebab dropdown */}
                            :
                        </FlexItem>
                    </Flex>
                </PageBreadcrumb>
                <PageSection>
                    <Flex>
                        {this.state.files.map((file) => {
                            const directory = file.substring(file.length - 1) === "/";
                            if (directory)
                                file = file.substring(0, file.length - 1);
                            return (
                                <Flex key={file} direction={{ default: "column" }} spaceItems={{ default: 'spaceItemsNone' }}>
                                    <FlexItem alignSelf={{ default: "alignSelfCenter" }}>
                                        <Icon size="xl">
                                            {directory
                                                ? <FolderIcon />
                                                : <FileIcon />}
                                        </Icon>
                                    </FlexItem>
                                    <FlexItem alignSelf={{ default: "alignSelfCenter" }}>{file}</FlexItem>
                                </Flex>
                            );
                        })}
                    </Flex>
                </PageSection>
            </Page>
        );
    }
}
