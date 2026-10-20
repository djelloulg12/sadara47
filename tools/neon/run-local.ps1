# تشغيل المنصة محليًا على قاعدة Neon — أمر واحد.
# ----------------------------------------------------------------------------
# يستعمل نفس نقطة الدخول التي ستعمل على Render: عملية Node واحدة تقدّم
# الموقع و/api معًا من قاعدة Neon.
#
#   powershell -ExecutionPolicy Bypass -File tools\neon\run-local.ps1
#
# ثم افتح: http://localhost:4180
#
# المتطلبات: Node مثبّت، وملف .env فيه سطر DATABASE_URL واحد (مستثنى من git).

$ErrorActionPreference = 'Stop'

# Node ليس على PATH افتراضيًا في هذا الجهاز.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $nodeDir = 'C:\Program Files\nodejs'
  if (Test-Path $nodeDir) { $env:PATH = "$nodeDir;$env:PATH" }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node غير مثبّت أو غير موجود على PATH.' -ForegroundColor Red
  exit 1
}

# شهادة وسيطة محلية (إن وُجدت) حتى يصل الاتصال إلى Neon من هذا الجهاز.
$cert = Join-Path $PSScriptRoot '..\intercept-roots.pem'
if (Test-Path $cert) { $env:NODE_EXTRA_CA_CERTS = $cert }

$env:PORT = if ($env:PORT) { $env:PORT } else { '4180' }

Write-Host "تشغيل المنصة على http://localhost:$env:PORT" -ForegroundColor Cyan
Write-Host 'أوقفها بـ Ctrl+C' -ForegroundColor DarkGray
Write-Host ''

node (Join-Path $PSScriptRoot 'server\server.js')
