<#
.SYNOPSIS
  Tests, builds and packages DotNet Solution Atlas, then shows how to install the result.

.DESCRIPTION
  Runs, in this order: the analyzer tests (dotnet test), npm ci (only if node_modules is missing),
  the TypeScript build, the tests of the map logic, and "npm run package" (builds the analyzer and
  creates the .vsix file in the extension folder). Stops at the first failing step.
  Needs the .NET SDK, Node.js and npm. Works in Windows PowerShell 5.1 and in PowerShell 7 (pwsh).

.PARAMETER Install
  Also installs the .vsix into VS Code ("code --install-extension").

.PARAMETER SkipTests
  Skips the tests (build and package only).

.EXAMPLE
  .\scripts\build-local.ps1
  .\scripts\build-local.ps1 -Install
#>
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$extension = Join-Path $root 'extension'
$results = New-Object System.Collections.Generic.List[object]
$total = [System.Diagnostics.Stopwatch]::StartNew()

function Invoke-Step {
    param([string]$Name, [string]$Directory, [scriptblock]$Command)

    Write-Host ''
    Write-Host "=== $Name ===" -ForegroundColor Cyan
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    Push-Location $Directory
    try {
        & $Command
        $ok = ($LASTEXITCODE -eq 0)
    }
    catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
        $ok = $false
    }
    finally {
        Pop-Location
    }
    $watch.Stop()
    $results.Add([pscustomobject]@{ Step = $Name; Result = $(if ($ok) { 'OK' } else { 'FAILED' }); Seconds = [math]::Round($watch.Elapsed.TotalSeconds, 1) })

    if (-not $ok) {
        Write-Host ''
        $results | Format-Table -AutoSize | Out-String | Write-Host
        Write-Host "Stopped: step '$Name' failed." -ForegroundColor Red
        exit 1
    }
}

foreach ($tool in 'dotnet', 'node', 'npm') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "'$tool' was not found. Install it and restart the terminal." -ForegroundColor Red
        exit 1
    }
}

if (-not $SkipTests) {
    Invoke-Step 'Analyzer tests (dotnet test)' $root { dotnet test 'analyzer/Atlas.Analyzer.Tests' --nologo }
}

if (-not (Test-Path (Join-Path $extension 'node_modules'))) {
    Invoke-Step 'Install dependencies (npm ci)' $extension { npm ci }
}

Invoke-Step 'Compile TypeScript (npm run compile)' $extension { npm run compile }

if (-not $SkipTests) {
    Invoke-Step 'Tests of the map logic (npm test)' $extension { npm test }
}

Invoke-Step 'Build the analyzer and package the .vsix (npm run package)' $extension { npm run package }

$vsix = Get-ChildItem -Path $extension -Filter '*.vsix' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $vsix) {
    Write-Host 'No .vsix file was created.' -ForegroundColor Red
    exit 1
}

if ($Install) {
    Invoke-Step 'Install in VS Code' $extension { code --install-extension $vsix.FullName --force }
}

$total.Stop()
Write-Host ''
Write-Host '=== Summary ===' -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String | Write-Host
Write-Host ('Total time: {0:N1} s' -f $total.Elapsed.TotalSeconds)
Write-Host ''
Write-Host ('Package: {0} ({1:N1} MB)' -f $vsix.FullName, ($vsix.Length / 1MB)) -ForegroundColor Green
Write-Host ''
Write-Host 'How to install it:' -ForegroundColor Green
Write-Host '  Option 1 (terminal):'
Write-Host ('    code --install-extension "{0}" --force' -f $vsix.FullName)
Write-Host '  Option 2 (user interface):'
Write-Host '    VS Code > Extensions (Ctrl+Shift+X) > "..." at the top right > "Install from VSIX..." > pick the file'
Write-Host '  Then: Ctrl+Shift+P > "Developer: Reload Window" (or restart VS Code).'
Write-Host '  Start: Ctrl+Shift+P > "DotNet Solution Atlas: Open map of the solution".'
Write-Host '  Uninstall: code --uninstall-extension local.dotnet-solution-atlas'
if ($Install) {
    Write-Host ''
    Write-Host 'The extension was installed. Reload the VS Code window.' -ForegroundColor Green
}
