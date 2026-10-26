param([Parameter(Mandatory)][string]$Ref, [Parameter(Mandatory)][string]$Out, [Parameter(Mandatory)][string]$PromptFile)
# Edita una imagen existente con Codex image_gen (adjunta -i) y guarda el PNG resultante en $Out.
$raiz = Split-Path $PSScriptRoot -Parent
if (Test-Path $Out) { Write-Output "SKIP $Out"; exit 0 }
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
$instr = Get-Content -Raw -Encoding UTF8 $PromptFile
$p = @"
PASOS OBLIGATORIOS EN ESTA MISMA EJECUCION:
1. Usa la herramienta image_gen para EDITAR la imagen adjunta y generar UNA imagen nueva.
2. NO termines tu turno ni respondas texto hasta haber generado el PNG.

$instr

Genera AHORA con image_gen.
"@
$codex = 'C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.15.0-win-x64\codex.cmd'
$t0 = Get-Date
$log = Join-Path $raiz ("tools\logs\codex_edit_" + [IO.Path]::GetFileNameWithoutExtension($Out) + ".log")
$ErrorActionPreference = 'Continue'
$p | & $codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox -i $Ref *> $log
$dirs = @("$env:APPDATA\orca\codex-runtime-home\home\generated_images", "$env:USERPROFILE\.codex\generated_images") | Where-Object { Test-Path $_ }
$png = Get-ChildItem $dirs -Recurse -Filter '*.png' | Where-Object { $_.LastWriteTime -gt $t0 } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $png) { Write-Output "FAIL $Out"; exit 1 }
Copy-Item $png.FullName $Out
Write-Output "OK $Out"
