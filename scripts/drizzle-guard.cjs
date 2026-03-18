const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
const targets = [
  path.join(root, 'apps'),
  path.join(root, 'libs'),
]

const ignoreDirs = new Set([
  'node_modules',
  'dist',
  '.git',
  '.trae',
])

const allowedExecuteFiles = new Set([
  normalizePath(path.join(root, 'libs/platform/src/modules/health/health.service.ts')),
  normalizePath(path.join(root, 'libs/interaction/src/purchase/purchase.service.ts')),
  normalizePath(path.join(root, 'libs/interaction/src/download/download.service.ts')),
])

const allowedRowsExtractionFiles = new Set([
  normalizePath(path.join(root, 'libs/interaction/src/purchase/purchase.service.ts')),
  normalizePath(path.join(root, 'libs/interaction/src/download/download.service.ts')),
])

const failures = []

for (const target of targets) {
  walk(target)
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`${failure}\n`)
  }
  process.exit(1)
}

process.stdout.write('drizzle guard passed\n')

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) {
        continue
      }
      walk(fullPath)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) {
      continue
    }
    inspectFile(fullPath)
  }
}

function inspectFile(filePath) {
  const normalized = normalizePath(filePath)
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)

  if (content.includes('db._query')) {
    failures.push(formatFailure(normalized, '禁止使用 db._query'))
  }

  if (!allowedExecuteFiles.has(normalized)) {
    lines.forEach((line, index) => {
      if (line.includes('db.execute(')) {
        failures.push(
          formatFailure(
            normalized,
            `禁止在业务层直接使用 db.execute (line ${index + 1})`,
          ),
        )
      }
    })
  }

  lines.forEach((line, index) => {
    const hasManualRowsParse = line.includes('(result as any).rows') || line.includes('extractRows(')
    if (hasManualRowsParse && !allowedRowsExtractionFiles.has(normalized)) {
      failures.push(
        formatFailure(
          normalized,
          `禁止手工 rows 解包 (line ${index + 1})`,
        ),
      )
    }
    if (line.includes('sql.raw(')) {
      failures.push(
        formatFailure(
          normalized,
          `sql.raw 仅允许白名单入口使用 (line ${index + 1})`,
        ),
      )
    }
  })
}

function formatFailure(filePath, message) {
  return `[drizzle-guard] ${filePath}: ${message}`
}

function normalizePath(value) {
  return value.replace(/\\/g, '/')
}
