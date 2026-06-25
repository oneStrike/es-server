import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const WORKSPACE_ROOT = resolve(__dirname, '..', '..')
const PUBLIC_BARREL_PATH = resolve(WORKSPACE_ROOT, 'db', 'core', 'index.ts')

describe('db core boundary check', () => {
  it.each([
    {
      name: '@db/core subpath imports',
      probePath: 'scripts/__db-core-boundary-probe__.ts',
      sourceText: "import { DrizzleService } from '@db/core/drizzle.service'\n",
      expectedMessage:
        'references forbidden db alias "@db/core/drizzle.service"',
    },
    {
      name: '@db/schema subpath imports',
      probePath: 'scripts/__db-schema-subpath-probe__.ts',
      sourceText: "import { appUser } from '@db/schema/app/app-user'\n",
      expectedMessage:
        'references forbidden db alias "@db/schema/app/app-user"',
    },
    {
      name: '@db/relations imports',
      probePath: 'scripts/__db-relations-probe__.ts',
      sourceText: "import { relations } from '@db/relations'\n",
      expectedMessage: 'references forbidden db alias "@db/relations"',
    },
    {
      name: 'relative schema imports outside db/schema',
      probePath: 'scripts/__db-schema-relative-probe__.ts',
      sourceText:
        "import * as schema from '../db/schema'\nconsole.log(schema)\n",
      expectedMessage: 'uses relative import into db/schema: "../db/schema"',
    },
    {
      name: 'relative relations imports outside db/core',
      probePath: 'scripts/__db-relations-relative-probe__.ts',
      sourceText:
        "import { adminRelations } from '../db/relations/admin'\nconsole.log(adminRelations)\n",
      expectedMessage:
        'uses relative import into db/relations: "../db/relations/admin"',
    },
  ])('rejects $name', ({ expectedMessage, probePath, sourceText }) => {
    withTemporaryFile(probePath, sourceText, () => {
      const result = runBoundaryCheck()

      expect(result.status).toBe(1)
      expect(result.output).toContain(expectedMessage)
    })
  })

  it('rejects non-allowlisted public barrel exports', () => {
    withPatchedFile(
      PUBLIC_BARREL_PATH,
      (sourceText) =>
        `${sourceText}\nexport { DRIZZLE_POOL } from './drizzle.provider'\n`,
      () => {
        const result = runBoundaryCheck()

        expect(result.status).toBe(1)
        expect(result.output).toContain(
          'exports forbidden provider symbol "DRIZZLE_POOL"',
        )
      },
    )
  })

  it('rejects aliased non-allowlisted public barrel exports', () => {
    withPatchedFile(
      PUBLIC_BARREL_PATH,
      (sourceText) =>
        `${sourceText}\nexport type { SQLWrapper as SQL } from './drizzle.type'\n`,
      () => {
        const result = runBoundaryCheck()

        expect(result.status).toBe(1)
        expect(result.output).toContain(
          'exports non-allowlisted source symbol "SQLWrapper"',
        )
      },
    )
  })
})

function runBoundaryCheck() {
  const result = spawnSync('pnpm db:core:check', {
    cwd: WORKSPACE_ROOT,
    encoding: 'utf8',
    shell: true,
  })

  return {
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    status: result.status,
  }
}

function withTemporaryFile(
  relativePath: string,
  sourceText: string,
  run: () => void,
) {
  const absolutePath = resolve(WORKSPACE_ROOT, relativePath)
  writeFileSync(absolutePath, sourceText, 'utf8')

  try {
    run()
  } finally {
    rmSync(absolutePath, { force: true })
  }
}

function withPatchedFile(
  filePath: string,
  patch: (sourceText: string) => string,
  run: () => void,
) {
  const originalSource = readFileSync(filePath, 'utf8')
  writeFileSync(filePath, patch(originalSource), 'utf8')

  try {
    run()
  } finally {
    writeFileSync(filePath, originalSource, 'utf8')
  }
}
