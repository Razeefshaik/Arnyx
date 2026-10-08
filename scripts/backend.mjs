import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const backend = resolve('backend')
const args = process.argv.slice(2)
const command = args.length ? args : ['spring-boot:run']
const child = process.platform === 'win32'
  ? spawn('powershell.exe', ['-NoProfile', '-File', resolve('scripts/backend.ps1'), ...command], { stdio: 'inherit', windowsHide: true })
  : spawn('mvn', ['-B', '-ntp', ...command], { cwd: backend, stdio: 'inherit' })
child.on('exit', code => process.exit(code ?? 1))
child.on('error', error => { console.error('Could not start Maven: ' + error.message); process.exit(1) })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
