#!/bin/bash

mkdir -p ../dist/chromium
# Copy assets from puppeteer-core to dist
cp -r ./node_modules/puppeteer-core/.local-chromium/*/*/* ./dist/chromium
cp -r ./config/* ./dist
