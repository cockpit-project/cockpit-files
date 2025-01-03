import React from "react";

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm
} from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { Popover } from "@patternfly/react-core/dist/esm/components/Popover";
import { Text } from "@patternfly/react-core/dist/esm/components/Text";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";

import cockpit from "cockpit";
import type { FileInfo } from "cockpit/fsinfo.ts";
import * as timeformat from "timeformat";

import { useFilesContext } from './app.tsx';
import type { FolderFileInfo } from "./app.tsx";
import { get_permissions, permissionShortStr } from "./common.ts";

const _ = cockpit.gettext;

export const FilesFooterDetail = ({
    files,
    showHidden,
    selected,
} : {
    files: FolderFileInfo[],
    showHidden: boolean,
    selected: FolderFileInfo[],
}) => {
    const { cwdInfo } = useFilesContext();

    if (selected.length > 1) {
        return (
            <div className="files-footer-info">
                <Text>
                    {cockpit.format(_("$0 files selected"), selected.length)}
                </Text>
            </div>
        );
    }

    if (cwdInfo === null) {
        return;
    }

    let fileInfoText = "";
    if (selected.length === 0) {
        const [dirCnt, hiddenCnt, restCnt] = files.reduce(
            (acc, file) => {
                if (file.name.startsWith(".") && !showHidden) {
                    acc[1] += 1;
                } else if (file.type === "dir" || (file.type === "lnk" && file.to === "dir")) {
                    acc[0] += 1;
                } else {
                    acc[2] += 1;
                }

                return acc;
            },
            [0, 0, 0]
        );

        fileInfoText = showHidden
            ? cockpit.format(_("Directory contains $0 directories, $1 files"), dirCnt, restCnt)
            : cockpit.format(_("Directory contains $0 directories, $1 files, $2 hidden"),
                             dirCnt, restCnt, hiddenCnt);
    } else {
        fileInfoText = selected[0].name;
    }

    const selectedFile = (selected.length === 1) ? selected[0] : cwdInfo;

    let permsPopover = null;
    let userGroup = null;

    if (selectedFile.mode !== undefined) {
        userGroup = <UserGroupPopover file={selectedFile} />;

        const mode = selectedFile.mode;
        const popoverBody = [_("Owner"), _("Group"), _("Others")].map((permGroup, i) => {
            return (
                <DescriptionListGroup key={permGroup}>
                    <DescriptionListTerm>
                        {permGroup}
                    </DescriptionListTerm>
                    <DescriptionListDescription>
                        {get_permissions(mode >> (6 - 3 * i)).toLowerCase()}
                    </DescriptionListDescription>
                </DescriptionListGroup>
            );
        });

        permsPopover = (
            <Popover
              id="files-footer-popover"
              hasAutoWidth
              bodyContent={
                  <DescriptionList
                    isHorizontal
                    isCompact
                  >
                      {popoverBody}
                  </DescriptionList>
              }
            >
                <Button
                  variant="link"
                  isInline
                  component="pre"
                >
                    {permissionShortStr(selectedFile.mode)}
                </Button>
            </Popover>
        );
    }

    return (
        <div className="files-footer-info">
            {fileInfoText}
            {selectedFile.mtime &&
            <Tooltip content={timeformat.dateTimeSeconds(selectedFile.mtime * 1000)}>
                <Text className="files-footer-mtime">
                    {timeformat.distanceToNow(selectedFile.mtime * 1000)}
                </Text>
            </Tooltip>}
            {userGroup}
            {permsPopover}
        </div>
    );
};

const UserGroupPopover = ({ file }: { file: FileInfo }) => (
    <Popover
        id="files-footer-usergroup-popover"
        hasAutoWidth
        bodyContent={
            <DescriptionList
                isHorizontal
                isCompact
            >
                <DescriptionListGroup key="user">
                    <DescriptionListTerm>
                        {_("User")}
                    </DescriptionListTerm>
                    <DescriptionListDescription>
                        {file.user}
                    </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup key="group">
                    <DescriptionListTerm>
                        {_("Group")}
                    </DescriptionListTerm>
                    <DescriptionListDescription>
                        {file.group}
                    </DescriptionListDescription>
                </DescriptionListGroup>
            </DescriptionList>
        }
    >
        <Button
            variant="link"
            isInline
            component="pre"
        >
            { (file.user === file.group) ? file.user : `${file.user}:${file.group}` }
        </Button>
    </Popover>
);
