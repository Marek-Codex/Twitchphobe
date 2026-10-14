# ============================================================================
#  build-zips.ps1  —  regenerate the two distribution zips from a clean set.
#
#  Usage:   pwsh tools/build-zips.ps1
#
#  Outputs to the PARENT folder (Brave Extensions\), where publish-twitchphobe.ps1
#  and the release expect them:
#     Twitchphobe-<ver>-dragdrop.zip    manifest.json at ROOT      -> drag onto
#                                        the extensions page
#     Twitchphobe-<ver>-unpacked.zip    files under Twitchphobe/   -> unzip, then
#                                        Load unpacked -> pick that folder
#
#  Both zips carry the SAME runtime files; only the top-level layout differs,
#  because Chrome is fussy: drag-drop needs manifest.json at the archive root,
#  while a human unzipping wants a tidy folder to point at. We are not fancy.
#
#  Dev cruft (tools/, .gitignore, the .user.js) is deliberately EXCLUDED — a
#  person unzipping this wants something that loads, not our build pipeline.
# ============================================================================
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repo = Split-Path $PSScriptRoot -Parent   # ...\Twitchphobe
$out  = Split-Path $repo -Parent           # ...\Brave Extensions
$ver  = (Get-Content -Raw (Join-Path $repo 'manifest.json') | ConvertFrom-Json).version

$files = @(
  'manifest.json'
  'README.md'
  'LICENSE'
  'NOTICE'
  'icons/icon128.png'
  'src/content.js'
  'src/net.js'
  'src/page.js'
  'src/patch.js'
)

function New-TwitchphobeZip {
  param([string]$Path, [string]$Prefix)
  if (Test-Path $Path) { Remove-Item $Path -Force }
  $zip = [System.IO.Compression.ZipFile]::Open($Path, 'Create')
  try {
    foreach ($rel in $files) {
      $src = Join-Path $repo $rel
      if (-not (Test-Path $src)) { throw "missing source file: $rel" }
      $entryName = if ($Prefix) { "$Prefix/$rel" } else { $rel }
      $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
      $stream = $entry.Open()
      try {
        $bytes = [System.IO.File]::ReadAllBytes($src)
        $stream.Write($bytes, 0, $bytes.Length)
      } finally { $stream.Dispose() }
    }
  } finally { $zip.Dispose() }
  $kb = [math]::Round((Get-Item $Path).Length / 1KB, 1)
  Write-Host ("built {0}  ({1} KB)" -f (Split-Path $Path -Leaf), $kb)
}

New-TwitchphobeZip -Path (Join-Path $out "Twitchphobe-$ver-dragdrop.zip") -Prefix $null
New-TwitchphobeZip -Path (Join-Path $out "Twitchphobe-$ver-unpacked.zip") -Prefix 'Twitchphobe'

# The .xpi is just the drag-drop archive (manifest.json at root) with a Firefox
# hat on — Firefox's "Load Temporary Add-on" accepts it as-is. Copy, don't rebuild.
$dragdrop = Join-Path $out "Twitchphobe-$ver-dragdrop.zip"
$xpi      = Join-Path $out "Twitchphobe-$ver.xpi"
Copy-Item $dragdrop $xpi -Force
Write-Host ("built {0}  ({1} KB)" -f (Split-Path $xpi -Leaf), ([math]::Round((Get-Item $xpi).Length / 1KB, 1)))

