#!/usr/bin/python3
# SPDX-License-Identifier: LGPL-2.1-or-later

import os
import stat
import sys

recursive = sys.argv[1] == "--recursive"
mode = sys.argv[2] if recursive else sys.argv[1]
paths = sys.argv[3:] if recursive else sys.argv[2:]


def chmod_nofollow(path: str, mode: int, dirfd: 'int | None' = None, *, capitalize_x: bool = False) -> int:
    exit_code = 0

    fd = os.open(path, os.O_PATH | os.O_NOFOLLOW, dir_fd=dirfd)
    try:
        st = os.fstat(fd)
        if stat.S_ISLNK(st.st_mode):
            return 0
        effective_mode = mode
        if capitalize_x and stat.S_ISREG(st.st_mode) and not (st.st_mode & 0o111):
            effective_mode = mode & ~0o111
        os.chmod(f"/proc/self/fd/{fd}", effective_mode)
    except PermissionError:
        sys.stderr.write(f"chmod: changing permissions of '{path}': Operation not permitted\n")
        exit_code = 1
    except FileNotFoundError:
        pass
    finally:
        os.close(fd)

    return exit_code


def chmod_recursive(path: str, mode: int) -> int:
    exit_code = chmod_nofollow(path, mode)
    for _, dirnames, filenames, dirfd in os.fwalk(path):
        for name in dirnames + filenames:
            exit_status = chmod_nofollow(name, mode, dirfd, capitalize_x=True)
            if exit_status != 0:
                exit_code = exit_status

    return exit_code


parsed_mode = int(mode, 8)
exit_code = 0
for path in paths:
    if recursive:
        ret = chmod_recursive(path, parsed_mode)
    else:
        ret = chmod_nofollow(path, parsed_mode)
    if ret != 0:
        exit_code = ret
sys.exit(exit_code)
