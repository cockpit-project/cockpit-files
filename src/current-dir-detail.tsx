import React from "react";

import { Text, TextVariants } from "@patternfly/react-core/dist/esm/components/Text";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";

import cockpit from "cockpit";
import * as timeformat from "timeformat";

import { useFilesContext } from './app.tsx';
import type { FolderFileInfo } from "./app.tsx";
import { permissionShortStr } from "./common.ts";

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

    return (
        <div className="cwd-info">
            {cwdInfoText}
            {cwdInfo.mtime &&
            <Tooltip content={timeformat.dateTimeSeconds(cwdInfo.mtime * 1000)}>
                <Text className="cwd-mtime">
                    {timeformat.distanceToNow(cwdInfo.mtime * 1000)}
                </Text>
            </Tooltip>}
            {cwdInfo.mode !== undefined &&
                <Text
                  className="cwd-permissions"
                  component={TextVariants.pre}
                >
                    {permissionShortStr(cwdInfo.mode)}
                </Text>}
        </div>
    );
};
