$repoRoot = Split-Path -Parent $PSScriptRoot
git -C $repoRoot config core.hooksPath .githooks
Write-Output "Configured git hooks path to .githooks"
