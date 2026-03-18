const { spawn } = require('node:child_process')
const process = require('node:process')
const { Client } = require('pg')

const WAIT_TIMEOUT_MS = parsePositiveInt(process.env.DB_WAIT_TIMEOUT_MS, 120000)
const WAIT_INTERVAL_MS = parsePositiveInt(process.env.DB_WAIT_INTERVAL_MS, 2000)
const SHOULD_SEED = /^(1|true|yes)$/i.test(process.env.DB_SEED ?? 'false')
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  process.stderr.write('[db-bootstrap] DATABASE_URL is required\n')
  process.exit(1)
}

main().catch((error) => {
  process.stderr.write(`[db-bootstrap] ${formatError(error)}\n`)
  process.exit(1)
})

async function main() {
  process.stdout.write('[db-bootstrap] waiting for database\n')
  await waitForDatabase(DATABASE_URL, WAIT_TIMEOUT_MS, WAIT_INTERVAL_MS)

  process.stdout.write('[db-bootstrap] running migrations\n')
  await runCommand('pnpm', ['db:migrate'])

  if (SHOULD_SEED) {
    process.stdout.write('[db-bootstrap] running seed data\n')
    await runCommand('pnpm', ['db:seed'])
  } else {
    process.stdout.write('[db-bootstrap] skipping seed data\n')
  }
}

async function waitForDatabase(connectionString, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs
  let lastError

  while (Date.now() < deadline) {
    const client = new Client({ connectionString })

    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      process.stdout.write('[db-bootstrap] database is ready\n')
      return
    } catch (error) {
      lastError = error
      try {
        await client.end()
      } catch {}

      const remainingMs = deadline - Date.now()
      if (remainingMs <= 0) {
        break
      }

      process.stdout.write(
        `[db-bootstrap] database not ready, retrying in ${intervalMs}ms (${Math.ceil(remainingMs / 1000)}s left)\n`,
      )
      await sleep(Math.min(intervalMs, remainingMs))
    }
  }

  throw new Error(
    `database was not ready within ${timeoutMs}ms${lastError ? `: ${formatError(lastError)}` : ''}`,
  )
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })

    child.on('error', reject)
  })
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
