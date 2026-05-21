# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

# Web frontend bundle. Defaults to the locally-built image produced by the
# `web` service in docker-compose.yml (built from ./addons/selkies-web-core).
# Override with --build-arg WEB_IMAGE=ghcr.io/... if you want the published one.
ARG WEB_IMAGE=selkies-web-core:latest
FROM ${WEB_IMAGE} AS selkies-web
FROM python:3

LABEL maintainer="https://github.com/danisla,https://github.com/ehfd"

# Install build deps
ARG PIP_BREAK_SYSTEM_PACKAGES=1
RUN python3 -m pip install --no-cache-dir --force-reinstall --upgrade build

# Build a python package for the webrtc app.
WORKDIR /opt/pypi

# Copy source files
COPY src ./src
COPY README.md pyproject.toml ./
# Include the production built web files in the wheel package
COPY --from=selkies-web /usr/share/nginx/html ./src/selkies/selkies_web
# setuptools only treats directories with __init__.py as packages — without
# this the `[tool.setuptools.package-data]` "selkies.selkies_web" declaration
# in pyproject.toml is ignored and the wheel ships without the web bundle,
# producing `No module named 'selkies.selkies_web'` at server start.
RUN touch ./src/selkies/selkies_web/__init__.py

ARG PYPI_PACKAGE=selkies
ARG PACKAGE_VERSION=0.0.0.dev0

# Patch the package name and version
RUN sed -i \
    -e "s|^name =.*|name = \"${PYPI_PACKAGE}\"|g" \
    -e "s|^version =.*|version = \"${PACKAGE_VERSION}\"|g" \
    pyproject.toml

RUN python3 -m build
