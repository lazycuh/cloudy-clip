#!/bin/bash

set -e

rm -rf dist
mkdir -p dist
rm -f scripts/{.mangled-selectors.js.json,.sitemap-entries.json}

TS=$(TZ="America/Los_Angeles" date "+%Y-%m-%d %H:%M:%S %Z%z")
sed -i.bak -E "s/<body/<body data-ts='$TS' /" src/index.html

function build-angular-app {
    set -e

    locale=$1

    echo -e "\nRunning Angular production build for locale \"$locale\""

    if [[ "$CIRCLE_BRANCH" == "main" ]]
    then
        CONFIGURATION="production"
    else
        CONFIGURATION="staging"
    fi

    pnpm ng build --configuration="${CONFIGURATION:=$(git rev-parse --abbrev-ref HEAD | tr -d '\n')}","$locale"

    mkdir -p "dist/$locale"
    cp -rf "build/browser/$locale" dist
}

function postprocess-built-files {
    set -e

    locale=$1

    node scripts/mangle-private-symbols.js "$locale"
    node scripts/mangle-selectors.js "$locale"
    node scripts/remove-non-ui-css-properties.js "$locale"
    node scripts/remove-mat-animation-no-op-class.js "$locale"
    node scripts/update-head-tag.js "$locale"
    node scripts/process-index-html-files.js "$locale"
    node scripts/generate-sitemap-entries.js "$locale"
}

build-angular-app en
# build-angular-app es
# build-angular-app vi

postprocess-built-files en
echo -e "=============== Verifying proper index pages for \"en\" ===============\n"
node scripts/verify-proper-index-pages.js en

# postprocess-built-files es
# echo -e "=============== Verifying proper index pages for \"es\" ===============\n"
# node scripts/verify-proper-index-pages.js es

# postprocess-built-files vi
# echo -e "=============== Verifying proper index pages for \"vi\" ===============\n"
# node scripts/verify-proper-index-pages.js vi


node scripts/generate-sitemap-file.js
node scripts/rewrite-base-href.js

mv dist/en/{*,.well-known} dist
rm -rf dist/en
cp scripts/assets/{_headers,robots.txt} dist
