$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..\backend')
$wrapperPath = Join-Path (Get-Location) 'mvnw.cmd'
if (Get-Command mvn -ErrorAction SilentlyContinue) {
    & mvn -B -ntp @args
} elseif (Test-Path -LiteralPath $wrapperPath) {
    & $wrapperPath -B -ntp @args
} else {
    throw 'Maven is unavailable. Install Maven or restore the Maven wrapper.'
}
exit $LASTEXITCODE
