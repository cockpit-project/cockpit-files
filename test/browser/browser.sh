#!/bin/sh
set -eux

export TEST_BROWSER=${TEST_BROWSER:-firefox}

TESTS="$(realpath $(dirname "$0"))"
export SOURCE="$(realpath $TESTS/../..)"
export LOGS="$(pwd)/logs"
mkdir -p "$LOGS"
chmod a+w "$LOGS"

# HACK: https://bugzilla.redhat.com/show_bug.cgi?id=2033020
dnf update -y pam || true

# install firefox (available everywhere in Fedora and RHEL)
# we don't need the H.264 codec, and it is sometimes not available (rhbz#2005760)
dnf install --disablerepo=fedora-cisco-openh264 -y --setopt=install_weak_deps=False firefox

# nodejs 10 is too old for current Cockpit test API
if grep -q platform:el8 /etc/os-release; then
    dnf module switch-to -y nodejs:16
fi

# Install cockpit from git main (for fsinfo)
TMPDIR=/var/tmp pip install git+https://github.com/cockpit-project/cockpit.git@main

# create user account for logging in
if ! id admin 2>/dev/null; then
    useradd -c Administrator -G wheel admin
    echo admin:foobar | chpasswd
fi

# set root's password
echo root:foobar | chpasswd

# avoid sudo lecture during tests
su -c 'echo foobar | sudo --stdin whoami' - admin

# create user account for running the test
if ! id runtest 2>/dev/null; then
    useradd -c 'Test runner' runtest
    # allow test to set up things on the machine
    mkdir -p /root/.ssh
    curl https://raw.githubusercontent.com/cockpit-project/bots/main/machine/identity.pub  >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
fi
chown -R runtest "$SOURCE"

# disable core dumps, we rather investigate them upstream where test VMs are accessible
echo core > /proc/sys/kernel/core_pattern

systemctl enable --now cockpit.socket

# Run tests as unprivileged user
# once we drop support for RHEL 8, use this:
# runuser -u runtest --whitelist-environment=TEST_BROWSER,TEST_ALLOW_JOURNAL_MESSAGES,TEST_AUDIT_NO_SELINUX,SOURCE,LOGS $TESTS/run-test.sh
runuser -u runtest --preserve-environment env USER=runtest HOME=$(getent passwd runtest | cut -f6 -d:) $TESTS/run-test.sh


RC=$(cat $LOGS/exitcode)
exit ${RC:-1}
