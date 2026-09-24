#!/bin/bash
# setup-hooks.sh — aktiviert die repo-lokalen Git-Hooks einmalig.
set -euo pipefail
git config core.hooksPath .githooks
echo "✓ Git-Hooks aktiviert (.githooks/pre-push: node --check server.js && npm test)"
