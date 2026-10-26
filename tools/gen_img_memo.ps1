param([Parameter(Mandatory)][string]$Id, [Parameter(Mandatory)][string]$PromptFile)
# Genera una imagen de memoria con Codex image_gen → img/memo/<Id>.png
# Trampas de Codex en esta máquina: bypass del sandbox, prompt por STDIN, forzar la generación, PNG en %APPDATA%\orca\...
$raiz = Split-Path $PSScriptRoot -Parent
$out = Join-Path $raiz "img\memo\$Id.png"
if ((Test-Path $out) -or (Test-Path ($out -replace '\.png$', '.webp'))) { Write-Output "SKIP $Id"; exit 0 }
New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null

$escena = Get-Content -Raw -Encoding UTF8 $PromptFile
$p = @"
PASOS OBLIGATORIOS EN ESTA MISMA EJECUCION:
1. Usa la herramienta image_gen para generar UNA imagen.
2. NO termines tu turno ni respondas texto hasta haber generado el PNG.

Tipo: ilustracion mnemotecnica educativa para una app de estudio de medicina (semiologia).
$escena

Estilo: ilustracion digital vibrante tipo comic/caricatura educativa, colores saturados y alegres, contornos limpios,
iluminacion dramatica, composicion centrada con UN protagonista claro y accion exagerada (movimiento, expresiones grandes),
fondo simple que no distraiga. Formato cuadrado 1:1 (1024x1024).
SIN texto, SIN letras, SIN numeros escritos, SIN logos dentro de la imagen. Sin gore, sin desnudos.

Genera AHORA con image_gen.
"@

$codex = 'C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.15.0-win-x64\codex.cmd'
$t0 = Get-Date
$log = Join-Path $raiz "tools\logs\codex_$Id.log"
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
$ErrorActionPreference = 'Continue'
$p | & $codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox *> $log
$dirs = @("$env:APPDATA\orca\codex-runtime-home\home\generated_images", "$env:USERPROFILE\.codex\generated_images") | Where-Object { Test-Path $_ }
$png = Get-ChildItem $dirs -Recurse -Filter '*.png' | Where-Object { $_.LastWriteTime -gt $t0 } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $png) { Write-Output "FAIL $Id"; exit 1 }
Copy-Item $png.FullName $out
Write-Output "OK $Id"
