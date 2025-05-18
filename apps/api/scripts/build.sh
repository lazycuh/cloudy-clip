#!/bin/bash

set -e

rm -rf dist
mkdir -p dist

curl -L https://github.com/a8m/envsubst/releases/download/v1.2.0/envsubst-`uname -s`-`uname -m` -o envsubst
chmod +x envsubst
sudo mv envsubst /usr/local/bin

cat .env.template | envsubst > dist/.env.${CIRCLE_BRANCH}

go mod tidy
go build .
mv api dist/cloudy-clip-api

cat dist/.env.${CIRCLE_BRANCH}

