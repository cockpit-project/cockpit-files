import React from "react";

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm
} from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { Popover } from "@patternfly/react-core/dist/esm/components/Popover";
import { Text } from "@patternfly/react-core/dist/esm/components/Text";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";

import cockpit from "cockpit";
import * as timeformat from "timeformat";

import { useFilesContext } from './app.tsx';
import type { FolderFileInfo } from "./app.tsx";
import { get_permissions, permissionShortStr } from "./common.ts";

const _ = cockpit.gettext;

export const CurrentDirDetail = ({
    files,
    showHidden,
} : {
    files: FolderFileInfo[],
    showHidden: boolean,
}) => {
    const { cwdInfo } = useFilesContext();

    if (cwdInfo === null) {
        return;
    }

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

    const cwdInfoText = showHidden
        ? cockpit.format(_("Directory contains $0 directories, $1 files"), dirCnt, restCnt)
        : cockpit.format(_("Directory contains $0 directories, $1 files, $2 hidden"),
                         dirCnt, restCnt, hiddenCnt);

    let cwdPermsPopover = null;
    if (cwdInfo.mode !== undefined) {
        const mode = cwdInfo.mode;
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

        cwdPermsPopover = (
            <Popover
              id="cwd-info-popover"
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
                    {permissionShortStr(cwdInfo.mode)}
                </Button>
            </Popover>
        );
    }

    return (
        <div className="cwd-info">
            {cwdInfoText}
            {cwdInfo.mtime &&
            <Tooltip content={timeformat.dateTimeSeconds(cwdInfo.mtime * 1000)}>
                <Text className="cwd-mtime">
                    {timeformat.distanceToNow(cwdInfo.mtime * 1000)}
                </Text>
            </Tooltip>}
            {cwdPermsPopover}
        </div>
    );
};
