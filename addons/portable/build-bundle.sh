#!/bin/bash
#
# Build the goIRL "portable" selkies bundle.
#
# Runs INSIDE a debian:12 container during the goIRL release workflow.
# Expects two env vars set by the workflow:
#
#   BUNDLE_DIR_NAME   e.g. selkies-gstreamer-portable-v0.1.0_amd64
#   SEMVER            e.g. 0.1.0
#
# Repo root is mounted at /work. The wheel produced earlier in the job
# lives at /work/bundle-stage/wheel/*.whl, and the static launcher / VERSION /
# README live at /work/bundle-stage/static/.
#
# Output: /work/<BUNDLE_DIR_NAME>.tar.gz, ready for the release upload.

set -euxo pipefail

: "${BUNDLE_DIR_NAME:?BUNDLE_DIR_NAME must be set by the workflow}"
: "${SEMVER:?SEMVER must be set by the workflow}"

export DEBIAN_FRONTEND=noninteractive

# Build deps: python venv + a native build chain for any sdist packages that
# lack manylinux wheels (cffi, cryptography, pylibsrtp, av, …). The list
# mirrors what the runtime VM has — keeping the linking environment the same.
apt-get update
apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip python3-dev \
    build-essential pkg-config \
    libffi-dev libssl-dev \
    libsrtp2-dev libopus-dev libvpx-dev \
    libavcodec-dev libavformat-dev libavutil-dev \
    libswscale-dev libswresample-dev \
    libxkbcommon-dev \
    ca-certificates curl

STAGE="/tmp/${BUNDLE_DIR_NAME}"
mkdir -p "${STAGE}"

# 1. Build the venv inside the stage dir. python3 -m venv creates symlinks
#    to the system python interpreter (which exists at /usr/bin/python3 on
#    Debian 12) — the launcher script we ship calls bin/python directly,
#    which resolves through that symlink at run time.
python3 -m venv "${STAGE}/venv"
"${STAGE}/venv/bin/pip" install --no-cache-dir --upgrade pip setuptools wheel

# 2. Install the selkies wheel produced earlier in the workflow.
"${STAGE}/venv/bin/pip" install --no-cache-dir /work/bundle-stage/wheel/*.whl

# 3. Drop in the launcher, README and VERSION prepared by the workflow.
cp /work/bundle-stage/static/selkies-gstreamer-run "${STAGE}/selkies-gstreamer-run"
chmod +x "${STAGE}/selkies-gstreamer-run"
cp /work/bundle-stage/static/README.md  "${STAGE}/README.md"
cp /work/bundle-stage/static/VERSION    "${STAGE}/VERSION"

# 4. Sanity-check the launcher boots and accepts CLI flags before we ship it.
#    `--help` triggers selkies' argparse and exits 0 — if any import or native
#    library is missing the venv would error out here and fail the release.
"${STAGE}/selkies-gstreamer-run" --help >/dev/null

# 5. Pack. `tar -czf foo.tar.gz -C /tmp <dirname>` produces foo.tar.gz with
#    a single top-level directory equal to <dirname>, which is exactly what
#    the goirl_gcloud Ansible playbook expects to feed `--strip-components=1`.
tar -C /tmp -czf "/work/${BUNDLE_DIR_NAME}.tar.gz" "${BUNDLE_DIR_NAME}"
