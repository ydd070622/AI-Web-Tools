$ErrorActionPreference = "Stop"

Write-Host "=== Building Electron main process ==="
npx tsc -p tsconfig.electron.json

if ($?) {
  Write-Host "=== Building Vite renderer ==="
  npx vite build
}

if ($?) {
  Write-Host "=== Build complete ==="
}
