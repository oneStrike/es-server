import process from 'node:process'
import { assertSafeDemoSeedEnvironment } from './environment-guard'
import { runDemoSeed } from './index'

interface DemoSeedCommand {
  checkEnvironmentOnly: boolean
}

// 解析 demo seed 命令行参数，返回是否仅检查环境。
function readCommand(argv = process.argv): DemoSeedCommand {
  const args = argv.slice(2)
  let checkEnvironmentOnly = false

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
      default:
        throw new Error(`Unknown demo seed argument: ${argument}`)
    }
  }

  return { checkEnvironmentOnly }
}

// demo seed 命令入口：先检查环境，再执行 seed。
async function main(): Promise<void> {
  const command = readCommand()
  const environment = assertSafeDemoSeedEnvironment(process.env)

  if (command.checkEnvironmentOnly) {
    process.stdout.write(
      `${JSON.stringify({
        databaseName: environment.databaseName,
        database: environment.safeLabel,
        status: 'environment-ready',
      })}\n`,
    )
    return
  }

  await runDemoSeed({
    environment: process.env,
  })
  process.stdout.write(
    `${JSON.stringify({
      databaseName: environment.databaseName,
      database: environment.safeLabel,
      status: 'pass',
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
