import React from "react";

import { Text, TextVariants } from "@patternfly/react-core/dist/esm/components/Text";

import cockpit from "cockpit"
import * as timeformat from "timeformat";

import { useFilesContext } from './app.tsx';

import type { FolderFileInfo } from "./app.tsx";
import { permissionShortStr } from "./common.ts";

const _ = cockpit.gettext;

export const CurrentDirDetail = ({ 
    files
} : {
    files: FolderFileInfo[]
}) => {
    const { cwdInfo } = useFilesContext();

    if (cwdInfo === null) {
        return;
    }

    const [dirCnt, hiddenCnt, restCnt] = files.reduce(
        (acc, file) => {
            if (file.name.startsWith(".")) {
                acc[1] += 1
            } else if (file.type === "dir" || (file.type === "lnk" && file.to === "dir")) {
                acc[0] += 1;
            } else {
                acc[2] += 1;
            }

            return acc;
        },
        [0, 0, 0]
    );

    const cwdInfoText = cockpit.format(_("Directory contains $0 directories, $1 files, $2 hidden"),
                                        dirCnt, restCnt, hiddenCnt);

    return (
        <div className="cwd-info">
            {cwdInfoText}
            <Text className="cwd-mtime">
                {cwdInfo.mtime ? timeformat.distanceToNow(cwdInfo.mtime * 1000) : null}
            </Text>
            {cwdInfo.mode !== undefined &&
                <Text className="cwd-permissions"
                  component={TextVariants.pre}
                >
                    {permissionShortStr(cwdInfo.mode)}
                </Text>
            }
        </div>
    )
}
