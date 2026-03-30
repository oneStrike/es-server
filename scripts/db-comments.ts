import process from 'node:process'
import {
  applySchemaComments,
  buildSchemaCommentsArtifact,
  writeSchemaCommentsFile,
} from '../db/comments/schema-comments'

async function main() {
  const args = new Set(process.argv.slice(2))
  const shouldCheck = args.has('--check')
  const shouldApply = args.has('--apply')
  const artifact = buildSchemaCommentsArtifact()
  const writeResult = writeSchemaCommentsFile(artifact)

  console.log(`Generated schema comments SQL: ${artifact.outputPath}`)
  console.log(`Table comments: ${artifact.tableCommentCount}`)
  console.log(`Column comments: ${artifact.columnCommentCount}`)
  console.log(`Warnings: ${artifact.warnings.length}`)

  if (artifact.warnings.length > 0) {
    console.log('Missing or unmatched comments:')

    for (const warning of artifact.warnings) {
      const location = warning.columnKey
        ? `${warning.exportName}.${warning.columnKey}`
        : warning.exportName

      console.log(`- ${location}: ${warning.message} (${warning.filePath || 'unknown file'})`)
    }
  }

  if (shouldCheck) {
    if (writeResult.changed) {
      console.error('Generated SQL file was outdated and has been refreshed.')
      process.exitCode = 1
    }

    if (artifact.warnings.length > 0) {
      console.error('Schema comments check failed because some tables or columns are missing JSDoc comments.')
      process.exitCode = 1
    }

    return
  }

  if (!shouldApply) {
    if (writeResult.changed) {
      console.log('Generated SQL file updated.')
    } else {
      console.log('Generated SQL file already up to date.')
    }
    return
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 环境变量未设置，无法应用数据库注释')
  }

  const result = await applySchemaComments({
    databaseUrl: process.env.DATABASE_URL,
  })

  console.log(`Applied ${result.appliedStatementCount} COMMENT statements to database.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
})
