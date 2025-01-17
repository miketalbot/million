#!/usr/bin/env bash

source $(dirname "$0")/helpers.sh

pending "Checking for errors..."
source scripts/check.sh &>/dev/null || fail "checks" "sh scripts/check.sh"
success "No errors found."
pending "Building distribution bundles..."
pnpm run build &>/dev/null || fail "build" "pnpm run build"
success "Built distribution bundles."
pendng "Please change the version number in \`CITATIONS.cff\`"
info "Run \`np\` to publish."