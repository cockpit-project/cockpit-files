# WIP build bundle in distro packages

Initial proof of concept for Debian, which has more packaged dependencies:

Install at least esbuild:
```
sudo apt install esbuild
```

Fedora's package does not currently work ([bugzilla](https://bugzilla.redhat.com/show_bug.cgi?id=2387212))
but a [fix was proposed](https://src.fedoraproject.org/rpms/golang-github-evanw-esbuild/pull-request/13).

Strip all devDependencies and binary esbuild blob, build node tarball
and replace it:
```
tools/node-modules runtime-tar /tmp/n.tar.xz
mv node_modules{,.full}
tar xf /tmp/n.tar.xz
```

Now `./build` should create a working `dist/`.

On Debian you can reduce it further by using distro packages for some JS
libraries, in particular React:

```
sudo apt install node-argparse node-gettext-parser node-mime-db node-react node-react-dom

for m in argparse gettext-parser mime-db react react-dom; do
    rm -rf node_modules/$m
    ln -sn /usr/share/nodejs/$m node_modules/$m
done
```

# Cockpit Files

This is the [Cockpit](https://cockpit-project.org/) user interface for managing
files.


# Development dependencies

On Debian/Ubuntu:

    sudo apt install gettext nodejs npm make

On Fedora:

    sudo dnf install gettext nodejs npm make


# Getting and building the source

These commands check out the source and build it into the `dist/` directory:

```
git clone https://github.com/cockpit-project/cockpit-files.git
cd cockpit-files
make
```

# Installing

`make install` compiles and installs the package in `/usr/local/share/cockpit/`. The
convenience targets `srpm` and `rpm` build the source and binary rpms,
respectively. Both of these make use of the `dist` target, which is used
to generate the distribution tarball. In `production` mode, source files are
automatically minified and compressed. Set `NODE_ENV=production` if you want to
duplicate this behavior.

For development, you usually want to run your module straight out of the git
tree. To do that, run `make devel-install`, which links your checkout to the
location were cockpit-bridge looks for packages. If you prefer to do
this manually:

```
mkdir -p ~/.local/share/cockpit
ln -s `pwd`/dist ~/.local/share/cockpit/cockpit-files
```

After changing the code and running `make` again, reload the Cockpit page in
your browser.

You can also use
[watch mode](https://esbuild.github.io/api/#watch) to
automatically update the bundle on every code change with

    npm run watch

or

    make watch

When developing against a virtual machine, watch mode can also automatically upload
the code changes by setting the `RSYNC` environment variable to
the remote hostname.

    RSYNC=c make watch

When developing against a remote host as a normal user, `RSYNC_DEVEL` can be
set to upload code changes to `~/.local/share/cockpit/` instead of
`/usr/local`.

    RSYNC_DEVEL=example.com make watch

To "uninstall" the locally installed version, run `make devel-uninstall`, or
remove manually the symlink:

    rm ~/.local/share/cockpit/cockpit-files

# Running eslint

Cockpit Files uses [ESLint](https://eslint.org/) to automatically check
JavaScript code style in `.js` and `.jsx` files.

eslint is executed as part of `test/static-code`, aka. `make codecheck`.

For developer convenience, the ESLint can be started explicitly by:

    npm run eslint

Violations of some rules can be fixed automatically by:

    npm run eslint:fix

Rules configuration can be found in the `.eslintrc.json` file.

## Running stylelint

Cockpit uses [Stylelint](https://stylelint.io/) to automatically check CSS code
style in `.css` and `scss` files.

styleint is executed as part of `test/static-code`, aka. `make codecheck`.

For developer convenience, the Stylelint can be started explicitly by:

    npm run stylelint

Violations of some rules can be fixed automatically by:

    npm run stylelint:fix

Rules configuration can be found in the `.stylelintrc.json` file.

# Running tests locally

Run `make check` to build an RPM, install it into a standard Cockpit test VM
(centos-8-stream by default), and run the test/check-application integration test on
it. This uses Cockpit's Chrome DevTools Protocol based browser tests, through a
Python API abstraction. Note that this API is not guaranteed to be stable, so
if you run into failures and don't want to adjust tests, consider checking out
Cockpit's test/common from a tag instead of main (see the `test/common`
target in `Makefile`).

After the test VM is prepared, you can manually run the test without rebuilding
the VM, possibly with extra options for tracing and halting on test failures
(for interactive debugging):

    TEST_OS=centos-9-stream test/check-application -tvs

It is possible to setup the test environment without running the tests:

    TEST_OS=centos-9-stream make prepare-check

You can also run the test against a different Cockpit image, for example:

    TEST_OS=fedora-rawhide make check
