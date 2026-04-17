import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
const libsRoot = path.join(repoRoot, 'libs')

function walkDtoFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDtoFiles(fullPath, acc)
      continue
    }

    if (
      entry.isFile() &&
      (fullPath.includes(`${path.sep}dto${path.sep}`) ||
        fullPath.endsWith('.dto.ts'))
    ) {
      acc.push(fullPath)
    }
  }

  return acc
}

describe('dTO governance regressions', () => {
  const dtoFiles = walkDtoFiles(libsRoot)

  it('removes EnumArrayProperty usage from DTO files', () => {
    const offenders = dtoFiles.filter((file) =>
      fs.readFileSync(file, 'utf8').includes('@EnumArrayProperty('),
    )

    expect(offenders).toEqual([])
  })

  it('does not import module-level eventing public API from DTO files', () => {
    const offenders = dtoFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf8')
      return (
        content.includes("@libs/platform/modules/eventing'") ||
        content.includes('@libs/platform/modules/eventing"')
      )
    })

    expect(offenders).toEqual([])
  })

  it('does not keep the old upload DTO forwarding file', () => {
    expect(
      fs.existsSync(path.join(repoRoot, 'libs/platform/src/dto/upload.dto.ts')),
    ).toBe(false)
  })

  it('does not import the old event-definition.doc source', () => {
    const offenders = walkDtoFiles(libsRoot).filter((file) =>
      fs.readFileSync(file, 'utf8').includes('event-definition.doc'),
    )

    expect(offenders).toEqual([])
  })

  it('keeps the growth DTOs on shared abstractions', () => {
    const pointRecord = fs.readFileSync(
      path.join(repoRoot, 'libs/growth/src/point/dto/point-record.dto.ts'),
      'utf8',
    )
    const experienceRecord = fs.readFileSync(
      path.join(
        repoRoot,
        'libs/growth/src/experience/dto/experience-record.dto.ts',
      ),
      'utf8',
    )
    const growthLedgerRecord = fs.readFileSync(
      path.join(
        repoRoot,
        'libs/growth/src/growth-ledger/dto/growth-ledger-record.dto.ts',
      ),
      'utf8',
    )
    const pointRule = fs.readFileSync(
      path.join(repoRoot, 'libs/growth/src/point/dto/point-rule.dto.ts'),
      'utf8',
    )
    const experienceRule = fs.readFileSync(
      path.join(
        repoRoot,
        'libs/growth/src/experience/dto/experience-rule.dto.ts',
      ),
      'utf8',
    )

    expect(pointRecord).toContain('BaseGrowthRecordSharedDto')
    expect(experienceRecord).toContain('BaseGrowthRecordSharedDto')
    expect(growthLedgerRecord).toContain('BaseGrowthRecordSharedDto')
    expect(pointRule).toContain('BaseGrowthRuleConfigDto')
    expect(experienceRule).toContain('BaseGrowthRuleConfigDto')
  })
})
