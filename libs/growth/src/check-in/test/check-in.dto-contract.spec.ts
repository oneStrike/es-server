import { existsSync, readFileSync } from 'node:fs'
import * as checkInDefinitionDto from '@libs/growth/check-in/dto/check-in-definition.dto'
import * as checkInExecutionDto from '@libs/growth/check-in/dto/check-in-execution.dto'
import * as checkInPlanDto from '@libs/growth/check-in/dto/check-in-plan.dto'
import * as checkInRecordDto from '@libs/growth/check-in/dto/check-in-record.dto'
import * as checkInRuntimeDto from '@libs/growth/check-in/dto/check-in-runtime.dto'
import * as checkInGrantDto from '@libs/growth/check-in/dto/check-in-streak-reward-grant.dto'
import * as checkInRuleDto from '@libs/growth/check-in/dto/check-in-streak-reward-rule.dto'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

const checkIn = {
  ...checkInDefinitionDto,
  ...checkInExecutionDto,
  ...checkInPlanDto,
  ...checkInRecordDto,
  ...checkInRuntimeDto,
  ...checkInGrantDto,
  ...checkInRuleDto,
}

function readSwaggerMetadata(target: object, propertyKey: string) {
  return {
    propertyKeys:
      Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, target) ?? [],
    propertyMetadata: Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      target,
      propertyKey,
    ),
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('check-in dto contract exports', () => {
  it('exports admin-side check-in DTO contracts from owner dto files', () => {
    expect(checkIn).toEqual(
      expect.objectContaining({
        CheckInGrantItemDto: expect.any(Function),
        CheckInPlanDetailResponseDto: expect.any(Function),
        CheckInPlanPageItemDto: expect.any(Function),
        CheckInReconciliationItemDto: expect.any(Function),
        CheckInStreakRewardRuleItemDto: expect.any(Function),
        CreateCheckInPlanDto: expect.any(Function),
        CreateCheckInStreakRewardRuleDto: expect.any(Function),
        QueryCheckInPlanDto: expect.any(Function),
        QueryCheckInReconciliationDto: expect.any(Function),
        RepairCheckInRewardDto: expect.any(Function),
        RepairCheckInRewardResponseDto: expect.any(Function),
        UpdateCheckInPlanDto: expect.any(Function),
        UpdateCheckInPlanStatusDto: expect.any(Function),
      }),
    )
  })

  it('exports app-side check-in DTO contracts from owner dto files', () => {
    expect(checkIn).toEqual(
      expect.objectContaining({
        CheckInActionResponseDto: expect.any(Function),
        CheckInCalendarDayDto: expect.any(Function),
        CheckInCalendarResponseDto: expect.any(Function),
        CheckInRecordItemDto: expect.any(Function),
        CheckInSummaryCycleDto: expect.any(Function),
        CheckInSummaryPlanDto: expect.any(Function),
        CheckInSummaryResponseDto: expect.any(Function),
        MakeupCheckInDto: expect.any(Function),
        QueryMyCheckInRecordDto: expect.any(Function),
      }),
    )
  })

  it('splits dto files by schema table and service contract family', () => {
    expect(
      existsSync('libs/growth/src/check-in/dto/check-in-plan.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/check-in/dto/check-in-cycle.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/check-in/dto/check-in-record.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/check-in/dto/check-in-streak-reward-rule.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/check-in/dto/check-in-streak-reward-grant.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/check-in/dto/check-in-definition.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/check-in/dto/check-in-runtime.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/check-in/dto/check-in-execution.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/check-in/dto/check-in-fragment.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/check-in/dto/check-in-scene.dto.ts'),
    ).toBe(false)
  })

  it('keeps internal check-in types but removes mirrored dto aliases', () => {
    const source = readFileSync(
      'libs/growth/src/check-in/check-in.type.ts',
      'utf8',
    )

    expect(source).toContain('export interface CheckInPlanSnapshot')
    expect(source).toContain('export type CreateCheckInCycleInput = Pick<')
    expect(source).not.toContain('export type CheckInQueryOrderByInput =')
    expect(source).not.toContain('export type CheckInDateOnly =')
    expect(source).not.toContain('export type CreateCheckInPlanInput =')
    expect(source).not.toContain('export type CheckInActionView =')
    expect(source).not.toContain('export type CheckInGrantView =')
  })

  it.each([
    {
      filePath: 'libs/growth/src/check-in/dto/check-in-plan.dto.ts',
      dto: checkIn.BaseCheckInPlanDto,
      propertyKey: 'deletedAt',
      decorator: 'DateProperty',
    },
    {
      filePath: 'libs/growth/src/check-in/dto/check-in-record.dto.ts',
      dto: checkIn.BaseCheckInRecordDto,
      propertyKey: 'bizKey',
      decorator: 'StringProperty',
    },
    {
      filePath: 'libs/growth/src/check-in/dto/check-in-streak-reward-rule.dto.ts',
      dto: checkIn.BaseCheckInStreakRewardRuleDto,
      propertyKey: 'deletedAt',
      decorator: 'DateProperty',
    },
    {
      filePath: 'libs/growth/src/check-in/dto/check-in-streak-reward-grant.dto.ts',
      dto: checkIn.BaseCheckInStreakRewardGrantDto,
      propertyKey: 'bizKey',
      decorator: 'StringProperty',
    },
  ])(
    'marks internal field $propertyKey as out-of-contract on $dto.name',
    ({ filePath, dto, propertyKey, decorator }) => {
      const source = readFileSync(filePath, 'utf8')
      const propertyPattern = new RegExp(
        `@${decorator}\\([\\s\\S]*?contract:\\s*false[\\s\\S]*?\\)\\s*${escapeRegex(propertyKey)}[!?]?:`,
      )

      expect(source).toMatch(propertyPattern)

      const { propertyKeys, propertyMetadata } = readSwaggerMetadata(
        dto.prototype,
        propertyKey,
      )

      expect(propertyKeys).not.toContain(`:${propertyKey}`)
      expect(propertyMetadata).toBeUndefined()
    },
  )
})
