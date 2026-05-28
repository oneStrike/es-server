import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  applySchemaComments,
  buildSchemaCommentsArtifact,
  writeSchemaCommentsFile,
} from './schema-comments'

const poolQuery = jest.fn()
const poolEnd = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: poolQuery,
    end: poolEnd,
  })),
}))

describe('schema comments', () => {
  beforeEach(() => {
    poolQuery.mockResolvedValue(undefined)
    poolEnd.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('builds schema comments without writing the generated file', () => {
    const outputPath = createTempOutputPath()
    const artifact = buildSchemaCommentsArtifact({ outputPath })

    expect(artifact.outputPath).toBe(outputPath)
    expect(() => readFileSync(outputPath, 'utf8')).toThrow()
  })

  it('writes schema comments only through the explicit writer', () => {
    const outputPath = createTempOutputPath()
    const artifact = buildSchemaCommentsArtifact({ outputPath })
    const result = writeSchemaCommentsFile(artifact)

    expect(result.changed).toBe(true)
    expect(readFileSync(outputPath, 'utf8')).toBe(artifact.sql)
  })

  it('applies schema comments without writing the generated file', async () => {
    const outputPath = createTempOutputPath()

    const result = await applySchemaComments({
      databaseUrl: 'postgres://example',
      outputPath,
    })

    expect(result.outputPath).toBe(outputPath)
    expect(result.appliedStatementCount).toBeGreaterThan(0)
    expect(poolQuery).toHaveBeenCalledTimes(1)
    expect(poolQuery.mock.calls[0][0]).toContain('COMMENT ON')
    expect(poolEnd).toHaveBeenCalledTimes(1)
    expect(() => readFileSync(outputPath, 'utf8')).toThrow()
  })
})

function createTempOutputPath() {
  const directoryPath = join(
    tmpdir(),
    `schema-comments-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )
  rmSync(directoryPath, { force: true, recursive: true })
  return join(directoryPath, 'generated.sql')
}
