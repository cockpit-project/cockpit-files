/* SPDX-License-Identifier: LGPL-2.1-or-later */
import cockpit from 'cockpit';
import type { FileInfo } from 'cockpit/fsinfo.ts';

// Determine the potential ownerships that a new item created in a particular
// directory might have, in case we have admin access.  If superuser mode is
// disabled, it's all a moot point, since we don't have any choice (in which
// case this function should not be used).  This is very much a heuristic, and
// might change in the future.
export function get_owner_candidates(info: FileInfo) {
    // In case the parent directory is setgid, we always override the group we
    // create as, mirroring the usual POSIX behaviour.  There are other cases
    // where the "BSD group semantics" come into play (like mount options) but
    // we don't currently support those.  We might in the future, though...
    const setgid = (info.group !== undefined && (info.mode || 0) & 0o2000) ? `${info.group}` : null;

    // Set() is ordered: we insert options in the order of preference.
    const candidates = new Set<string>();

    // Most preferred option: create with the ownership of the parent
    // directory.  Don't offer this if:
    //   - the directory is a world-writable sticky (like /tmp)
    //   - we don't know the ownership information of the parent
    if (!info.mode || (info.mode & 0o1222) !== 0o1222) {
        if (info.user !== undefined && info.group !== undefined) {
            candidates.add(`${info.user}:${info.group}`);
        }
    }

    // If we're authenticated as the superuser, we can do root:root as well.
    candidates.add(`root:${setgid || 'root'}`);

    // The last option is always available: create as the normal user.  In case
    // of something inside of the user's home directory, this was probably the
    // first option as well...
    candidates.add(`${cockpit.info.user.name}:${setgid || cockpit.info.user.group}`);

    return candidates;
}
