import { existsSync, readFileSync } from 'node:fs'
import * as checkIn from '@libs/growth/check-in'

describe('check-in dto contract exports', () => {
  it('exports admin-side check-in DTO contracts from libs', () => {
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

  it('exports app-side check-in DTO contracts from libs', () => {
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
    expect(source).not.toContain('export type CreateCheckInPlanInput =')
    expect(source).not.toContain('export type CheckInActionView =')
    expect(source).not.toContain('export type CheckInGrantView =')
  })
})
