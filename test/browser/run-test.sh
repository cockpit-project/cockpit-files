set -eux

cd "${SOURCE}"

# tests need cockpit's bots/ libraries and test infrastructure
rm -f bots  # common local case: existing bots symlink
make bots test/common

if [ -e .git ]; then
    tools/node-modules checkout
    # disable detection of affected tests; testing takes too long as there is no parallelization
    mv .git dot-git
else
    # upstream tarballs ship test dependencies; print version for debugging
    grep '"version"' node_modules/sizzle/package.json
fi

. /run/host/usr/lib/os-release
export TEST_OS="${ID}-${VERSION_ID/./-}"

if [ "${TEST_OS#centos-}" != "$TEST_OS" ]; then
    TEST_OS="${TEST_OS}-stream"
fi

# Chromium sometimes gets OOM killed on testing farm
export TEST_BROWSER=firefox

EXCLUDES=""

# make it easy to check in logs
echo "TEST_ALLOW_JOURNAL_MESSAGES: ${TEST_ALLOW_JOURNAL_MESSAGES:-}"
echo "TEST_AUDIT_NO_SELINUX: ${TEST_AUDIT_NO_SELINUX:-}"

GATEWAY="$(python3 -c 'import socket; print(socket.gethostbyname("_gateway"))')"
RC=0
./test/common/run-tests \
    --nondestructive \
    --machine "${GATEWAY}":22 \
    --browser "${GATEWAY}":9090 \
    $EXCLUDES \
|| RC=$?
cp --verbose Test* "$LOGS" || true
exit $RC
