#!/bin/bash

set -e

rm -rf dist
mkdir -p dist

export TRADE_TIMELINE_UPSTREAM="http://localhost:${TRADE_TIMELINE_SERVER_PORT}"
export TRADE_TIMELINE_ENVIRONMENT="${CIRCLE_BRANCH}"

node esbuild.config.js
