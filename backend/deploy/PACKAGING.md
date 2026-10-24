# Package backend for Vultr (`yoyknowmail-backend.tar.gz`)

Do **not** include credentials, local `.env`, venvs, caches, or DB dumps.

## From repo root (PowerShell / Windows)

Windows `tar` exclude globs are unreliable; stage a clean copy first:

```powershell
cd C:\Users\Th\Desktop\Saadi
$out = Join-Path (Get-Location) "yoyknowmail-backend.tar.gz"
$stage = Join-Path (Get-Location) ".pack-stage"
if (Test-Path $out) { Remove-Item $out -Force }
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path "$stage\backend" | Out-Null

Get-ChildItem -Path ".\backend" -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring((Resolve-Path ".\backend\").Path.Length)
  $parts = $rel -split '[\\/]'
  -not (
    $parts -contains '.venv' -or $parts -contains '__pycache__' -or
    $parts -contains '.pytest_cache' -or $_.Name -eq '.env' -or
    $_.Extension -eq '.pyc' -or $_.Name -like '*.sql.dump' -or $_.Name -like '*.dump'
  )
} | ForEach-Object {
  $rel = $_.FullName.Substring((Resolve-Path ".\backend\").Path.Length)
  $dest = Join-Path "$stage\backend" $rel
  New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
  Copy-Item $_.FullName $dest -Force
}

Push-Location $stage; tar -czf $out backend; Pop-Location
Remove-Item $stage -Recurse -Force
Get-Item $out | Select-Object FullName, Length, LastWriteTime
```

## From repo root (bash)

```bash
cd /path/to/Saadi
tar -czf yoyknowmail-backend.tar.gz \
  --exclude='backend/.env' \
  --exclude='backend/.venv' \
  --exclude='backend/**/__pycache__' \
  --exclude='backend/**/*.pyc' \
  --exclude='backend/.pytest_cache' \
  --exclude='backend/**/*.sql.dump' \
  --exclude='backend/**/*.dump' \
  backend
```

## On Vultr (extract only — no migrate until approved)

```bash
sudo mkdir -p /opt/yoyknowmail-app
sudo tar -xzf yoyknowmail-backend.tar.gz -C /opt/yoyknowmail-app --strip-components=1
# Install deps with server Python (see README.md)
# Do NOT overwrite /opt/yoyknowmail/api.py or touch yoyknowmail-api
```

## Verify archive contents (no secrets)

```bash
tar -tzf yoyknowmail-backend.tar.gz | head
tar -tzf yoyknowmail-backend.tar.gz | grep -E '\.env$|\.venv|dump' || echo "OK: no .env/venv/dumps listed"
```
