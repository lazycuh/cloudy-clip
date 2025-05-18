#!/bin/bash

set -e

if [ "$CIRCLE_BRANCH" == "main" ]; then
    echo "On main branch, always run the job."
    exit 0
fi

if [ "$CIRCLE_BRANCH" == "staging" ]; then
    echo "Not a PR. Exiting."
    circleci-agent step halt
fi

function matchPattern {
    PATTERN="$1"

    git diff --name-only origin/staging origin/$CIRCLE_BRANCH | grep -E "$PATTERN" | wc -l | awk "{print \$1}"
}

if [ $(matchPattern "$1") == "0" ]; then
    echo "No changes detected in $1. Exiting."
    circleci-agent step halt
fi
