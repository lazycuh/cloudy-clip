#!/bin/bash

set -e

rm -rf dist
mkdir -p dist

export CLOUDY_CLIP_UPSTREAM="http://localhost:${CLOUDY_CLIP_SERVER_PORT}"
export CLOUDY_CLIP_ENVIRONMENT="${CIRCLE_BRANCH}"

node esbuild.config.js
