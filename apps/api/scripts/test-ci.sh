#!/bin/bash

set -e

TEST_PACKAGES=$(go list ./test/... | grep -Ev "(/test/debug|/test/utils|/test/subscription/helpers)" | tail -n +2)

if [ $# -eq 0 ]; then
    # Have to exclude common folder itself to avoid this warning `warning: no packages being tested depend on matches for pattern ./internal/common`
    PACKAGES=$(ls ./internal | grep -v common | tr -s '\n' ' ')

    for package in $PACKAGES; do
        if [[ -z "$COVER_PACKAGES" ]]; then
            COVER_PACKAGES="./internal/$package"
        else
            COVER_PACKAGES="$COVER_PACKAGES,./internal/$package"
        fi
    done

    COMMON_PACKAGES="$(ls ./internal/common | tr -s '\n' ' ')"
    for package in $COMMON_PACKAGES; do
        COVER_PACKAGES="$COVER_PACKAGES,./internal/common/$package"
    done

    CLOUDY_CLIP_EXECUTION_PROFILE=ci go test -v -race -coverprofile=coverage.out -covermode=atomic -coverpkg=$COVER_PACKAGES $TEST_PACKAGES

    go tool cover -html=coverage.out -o coverage.html

elif [ "$1" == "-no-coverage" ]; then
    CLOUDY_CLIP_EXECUTION_PROFILE=ci go test -v $TEST_PACKAGES
fi

