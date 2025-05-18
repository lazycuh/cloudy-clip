#!/bin/bash

set -e

mkdir -p dist/functions

cp ../orchestrator/dist/process-requests.js dist/functions/[[api]].js

cd dist
DEPLOYMENT_BRANCH=`if [[ "$CIRCLE_BRANCH" == 'production' ]]; then echo 'main'; else echo "$CIRCLE_BRANCH"; fi`
wrangler pages deploy . --project-name=cloudy-clip-web --branch "$DEPLOYMENT_BRANCH"
