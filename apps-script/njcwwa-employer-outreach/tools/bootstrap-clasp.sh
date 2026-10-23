#!/usr/bin/env bash
set -euo pipefail

EXPECTED_EMAIL="weldingworkforcealliance@gmail.com"
CLASP_VERSION="3.4.1"
PROJECT_TITLE="NJCWWA Employer Outreach Automation"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOTSTRAP_DIR="$PROJECT_ROOT/.tmp/clasp-bootstrap"

command -v node >/dev/null || { echo "Node.js 20 or newer is required." >&2; exit 1; }
echo "Node: $(node --version)"

AUTH_OUTPUT="$(npx --yes "@google/clasp@$CLASP_VERSION" show-authorized-user --json 2>&1)" || {
  echo "clasp is not authorized. Run: npx @google/clasp@$CLASP_VERSION login" >&2
  exit 1
}
if [[ "$AUTH_OUTPUT" != *"$EXPECTED_EMAIL"* ]]; then
  echo "clasp is not authorized as $EXPECTED_EMAIL. Run clasp login with the Alliance account only." >&2
  exit 1
fi

if [[ -f "$PROJECT_ROOT/.clasp.json" ]]; then
  echo ".clasp.json already exists. Review it instead of creating another Apps Script project." >&2
  exit 1
fi

rm -rf "$BOOTSTRAP_DIR"
mkdir -p "$BOOTSTRAP_DIR"
(
  cd "$BOOTSTRAP_DIR"
  npx --yes "@google/clasp@$CLASP_VERSION" create-script --title "$PROJECT_TITLE" --type standalone
)
cp "$BOOTSTRAP_DIR/.clasp.json" "$PROJECT_ROOT/.clasp.json"
rm -rf "$BOOTSTRAP_DIR"

cd "$PROJECT_ROOT"
npm run check
npx --yes "@google/clasp@$CLASP_VERSION" push --force
npx --yes "@google/clasp@$CLASP_VERSION" open-script

echo "Completed. Run verifyAllianceSetup in Apps Script. Do not install triggers yet."
