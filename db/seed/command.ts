import process from 'node:process'
import { assertSafeDemoSeedEnvironment } from '../runtime-guard'
import { readRegisteredDisposableDatabaseTarget } from '../targets/registered-disposable-target'
import { runDemoSeed } from './index'

interface DemoSeedCommand {
  checkEnvironmentOnly: boolean
  targetId: string
}

function readCommand(argv = process.argv): DemoSeedCommand {
  const args = argv.slice(2)
  let checkEnvironmentOnly = false
  let targetId: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    switch (argument) {
      case '--check-env': {
        if (checkEnvironmentOnly) {
          throw new Error('--check-env may be specified only once')
        }
        checkEnvironmentOnly = true
        break
      }
      case '--target-id': {
        if (targetId) {
          throw new Error('--target-id may be specified only once')
        }
        const value = args[index + 1]
        if (!value || value.startsWith('--')) {
          throw new Error('--target-id requires a registered target id')
        }
        targetId = value
        index += 1
        break
      }
      default:
        throw new Error(`Unknown demo seed target argument: ${argument}`)
    }
  }

  if (!targetId) {
    throw new Error('--target-id is required')
  }
  return { checkEnvironmentOnly, targetId }
}

async function main(): Promise<void> {
  const command = readCommand()
  const target = readRegisteredDisposableDatabaseTarget(command.targetId)
  const environment = {
    ...process.env,
    DATABASE_URL: target.url,
  }
  assertSafeDemoSeedEnvironment(environment)

  if (command.checkEnvironmentOnly) {
    process.stdout.write(
      `${JSON.stringify({
        databaseName: target.databaseName,
        status: 'environment-ready',
        target: target.safeLabel,
        targetId: target.id,
      })}\n`,
    )
    return
  }

  await runDemoSeed({
    environment,
    target,
  })
  process.stdout.write(
    `${JSON.stringify({
      databaseName: target.databaseName,
      status: 'pass',
      target: target.safeLabel,
      targetId: target.id,
    })}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 1
})

export { readCommand }
