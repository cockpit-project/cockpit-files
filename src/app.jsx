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
import { Flex, FlexItem, Icon, Page, PageSection } from "@patternfly/react-core";
import { FileIcon, FolderIcon } from "@patternfly/react-icons";

const _ = cockpit.gettext;

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

    render() {
        return (
            <Page>
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
