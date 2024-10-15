#!/usr/bin/python3

import os.path
import sys

# Exit with a special error code when there is no SELinux support to avoid unneeded errors.
if not os.path.exists("/sys/fs/selinux"):
    sys.exit(2)

path = sys.argv[1]

try:
    selinux_xattr = os.getxattr(path, "security.selinux", follow_symlinks=False)
except OSError as exc:
    print(f"exception reading extended attrs for {path}: {exc}", file=sys.stderr)
    sys.exit(1)

try:
    sys.stdout.write(selinux_xattr.decode().rstrip('\x00'))
except UnicodeError as exc:
    print(f"exception decoding xattr for {path}: {exc}", file=sys.stderr)
    sys.exit(1)
