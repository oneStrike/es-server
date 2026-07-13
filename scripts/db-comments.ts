import { readFileSync } from 'node:fs'
import process from 'node:process'
import {
  buildSchemaCommentsArtifact,
  getSchemaCommentsOutputPath,
  writeSchemaCommentsFile,
} from '../db/comments/schema-comments'

async function main() {
  const args = process.argv.slice(2)
  const unknownArguments = args.filter(
    (argument) => argument !== '--apply' && argument !== '--check',
  )
  if (unknownArguments.length > 0) {
    throw new Error(`未知参数: ${unknownArguments.join(' ')}`)
  }
  if (args.includes('--apply')) {
    throw new Error(
      '数据库注释只能由受会话锁保护的 db/migrate.ts 同步，独立 --apply 已移除',
    )
  }
  const shouldCheck = args.includes('--check')
  const artifact = buildSchemaCommentsArtifact()

  console.log(`Schema comments SQL: ${artifact.outputPath}`)
  console.log(`Table comments: ${artifact.tableCommentCount}`)
  console.log(`Column comments: ${artifact.columnCommentCount}`)
  console.log(`Warnings: ${artifact.warnings.length}`)

  if (artifact.warnings.length > 0) {
    console.log('Missing or unmatched comments:')

    for (const warning of artifact.warnings) {
      const location = warning.columnKey
        ? `${warning.exportName}.${warning.columnKey}`
        : warning.exportName

      console.log(
        `- ${location}: ${warning.message} (${warning.filePath || 'unknown file'})`,
      )
    }
  }

  if (shouldCheck) {
    const generatedSql = readSchemaCommentsFile(artifact.outputPath)
    if (generatedSql !== artifact.sql) {
      console.error(
        'Generated SQL file is outdated. Run `pnpm db:comments:generate` to refresh it.',
      )
      process.exitCode = 1
    }

    if (artifact.warnings.length > 0) {
      console.error(
        'Schema comments check failed because some tables or columns are missing JSDoc comments.',
      )
      process.exitCode = 1
    }

    return
  }

  const writeResult = writeSchemaCommentsFile(artifact)

  if (writeResult.changed) {
    console.log('Generated SQL file updated.')
  } else {
    console.log('Generated SQL file already up to date.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error)
  process.exitCode = 1
})

function readSchemaCommentsFile(outputPath = getSchemaCommentsOutputPath()) {
  try {
    return readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n')
  } catch {
    return null
  }
}
