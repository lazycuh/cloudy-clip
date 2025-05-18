#!/bin/bash

set -e

docker run \
    --name cloudy-clip-db \
    -v $(pwd)/.db:/var/lib/postgresql/data \
    -e POSTGRES_HOST_AUTH_METHOD=trust \
    -e POSTGRES_DB=cloudy-clip-db \
    -p 9876:5432 \
    --rm postgres:17.3