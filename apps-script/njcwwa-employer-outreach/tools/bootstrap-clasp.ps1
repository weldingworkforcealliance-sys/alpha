$ErrorActionPreference = "Stop"

$ExpectedEmail = "weldingworkforcealliance@gmail.com"
$ClaspVersion = "3.4.1"
$ProjectTitle = "NJCWWA Employer Outreach Automation"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BootstrapDir = Join-Path $ProjectRoot ".tmp\clasp-bootstrap"

Write-Host "Checking Node.js..."
$nodeVersion = node --version
if (-not $nodeVersion) { throw "Node.js 20 or newer is required." }
Write-Host "Node: $nodeVersion"

Write-Host "Checking clasp authorization..."
$authOutput = npx --yes "@google/clasp@$ClaspVersion" show-authorized-user --json 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
  throw "clasp is not authorized. Run: npx @google/clasp@$ClaspVersion login"
}
if ($authOutput -notmatch [regex]::Escape($ExpectedEmail)) {
  throw "clasp is not authorized as $ExpectedEmail. Stop and run clasp login with the Alliance account only."
}

if (Test-Path (Join-Path $ProjectRoot ".clasp.json")) {
  throw ".clasp.json already exists. Review it instead of creating another Apps Script project."
}

if (Test-Path $BootstrapDir) { Remove-Item $BootstrapDir -Recurse -Force }
New-Item -ItemType Directory -Path $BootstrapDir | Out-Null

Push-Location $BootstrapDir
try {
  Write-Host "Creating standalone Apps Script project..."
  npx --yes "@google/clasp@$ClaspVersion" create-script --title $ProjectTitle --type standalone
  if ($LASTEXITCODE -ne 0) { throw "clasp create-script failed." }
  Copy-Item (Join-Path $BootstrapDir ".clasp.json") (Join-Path $ProjectRoot ".clasp.json")
}
finally {
  Pop-Location
}

Remove-Item $BootstrapDir -Recurse -Force

Push-Location $ProjectRoot
try {
  Write-Host "Running local checks..."
  npm run check
  if ($LASTEXITCODE -ne 0) { throw "Local checks failed. Nothing was pushed." }

  Write-Host "Pushing project files to Apps Script..."
  npx --yes "@google/clasp@$ClaspVersion" push --force
  if ($LASTEXITCODE -ne 0) { throw "clasp push failed." }

  Write-Host "Opening Apps Script editor..."
  npx --yes "@google/clasp@$ClaspVersion" open-script
}
finally {
  Pop-Location
}

Write-Host "Completed. Run verifyAllianceSetup in Apps Script. Do not install triggers yet."
