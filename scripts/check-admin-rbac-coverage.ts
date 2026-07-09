import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const ADMIN_API_SRC = join(ROOT, 'apps/admin-api/src')
const CONTROLLER_RE = /@Controller\(([^)]*)\)/
const HTTP_DECORATOR_RE = /@(?:Get|Post|Put|Patch|Delete)\([^)]*\)/
const PERMISSION_RE = /@AdminPermission\(\{\s*code:\s*['"`]([^'"`]+)['"`]/
const CODE_RE = /^[a-z0-9]+(?::[a-z0-9]+)*(?:[-:][a-z0-9]+)*$/

interface Finding {
  file: string
  line: number
  message: string
}

function listControllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      return listControllerFiles(full)
    }
    return entry.isFile() && entry.name.endsWith('.controller.ts') ? [full] : []
  })
}

function controllerPath(source: string) {
  const match = source.match(CONTROLLER_RE)
  const literal = match?.[1].trim().match(/^['"`]([^'"`]*)['"`]/)
  return literal?.[1]
}

function lineOf(lines: string[], index: number) {
  let offset = 0
  for (let i = 0; i < lines.length; i += 1) {
    offset += lines[i].length + 1
    if (offset > index) {
      return i + 1
    }
  }
  return lines.length
}

function checkControllers() {
  const findings: Finding[] = []
  const codes = new Map<string, string>()

  for (const file of listControllerFiles(ADMIN_API_SRC)) {
    const source = readFileSync(file, 'utf8')
    const ctrlPath = controllerPath(source)
    if (!ctrlPath?.startsWith('admin')) {
      continue
    }
    const lines = source.split(/\r?\n/)
    const matches = [...source.matchAll(new RegExp(HTTP_DECORATOR_RE, 'g'))]
    for (const match of matches) {
      const start = match.index ?? 0
      const rest = source.slice(start)
      const methodMatch = rest.match(/\n\s*(?:async\s+)?\w+\s*\(/)
      const block = methodMatch ? rest.slice(0, methodMatch.index) : rest
      if (block.includes('@Public(') || block.includes('@AdminAuthOnly(')) {
        continue
      }
      const permission = block.match(PERMISSION_RE)
      const fileRef = `${relative(ROOT, file)}:${lineOf(lines, start)}`
      if (!permission) {
        findings.push({
          file,
          line: lineOf(lines, start),
          message: `${fileRef} missing @AdminPermission or @AdminAuthOnly`,
        })
        continue
      }
      const code = permission[1]
      if (!CODE_RE.test(code)) {
        findings.push({
          file,
          line: lineOf(lines, start),
          message: `${fileRef} invalid permission code "${code}"`,
        })
      }
      const existing = codes.get(code)
      if (existing) {
        findings.push({
          file,
          line: lineOf(lines, start),
          message: `${fileRef} duplicate permission code "${code}", first seen at ${existing}`,
        })
      } else {
        codes.set(code, fileRef)
      }
    }
  }

  return findings
}

function checkLegacyRoleDebt() {
  const findings: Finding[] = []
  const targets = [
    join(ROOT, 'apps/admin-api/src'),
    join(ROOT, 'libs/identity/src'),
    join(ROOT, 'db/schema/admin'),
  ]
  const forbidden = [
    'AdminUserRoleEnum',
    'adminUser.role',
    'this.adminUser.role',
    'role === 1',
    'role: smallint',
    'admin_user_role_valid_chk',
  ]
  const visit = (dir: string) => {
    if (!existsSync(dir)) {
      return
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(full)
        continue
      }
      if (!entry.isFile() || !full.endsWith('.ts')) {
        continue
      }
      const source = readFileSync(full, 'utf8')
      const lines = source.split(/\r?\n/)
      lines.forEach((line, index) => {
        for (const needle of forbidden) {
          if (line.includes(needle)) {
            findings.push({
              file: full,
              line: index + 1,
              message: `${relative(ROOT, full)}:${index + 1} contains legacy RBAC role debt: ${needle}`,
            })
          }
        }
      })
    }
  }
  targets.forEach(visit)
  return findings
}

const findings = [...checkControllers(), ...checkLegacyRoleDebt()]
if (findings.length > 0) {
  console.error(findings.map((finding) => finding.message).join('\n'))
  process.exit(1)
}

console.log('admin RBAC coverage check passed')
