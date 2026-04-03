import { PATH_METADATA } from '@nestjs/common/constants'
import { AuditActionTypeEnum } from '../system/audit/audit.constant'
import { CheckInController } from './check-in.controller'

describe('admin CheckInController audit metadata', () => {
  it('registers stable admin route segments for plan and reconciliation endpoints', () => {
    const getPlanPageHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'getPlanPage',
    )?.value
    const getPlanDetailHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'getPlanDetail',
    )?.value
    const createPlanHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'createPlan',
    )?.value
    const updatePlanHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'updatePlan',
    )?.value
    const updatePlanStatusHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'updatePlanStatus',
    )?.value
    const getReconciliationPageHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'getReconciliationPage',
    )?.value
    const repairRewardHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'repairReward',
    )?.value

    expect(Reflect.getMetadata(PATH_METADATA, CheckInController)).toBe(
      'admin/check-in',
    )
    expect(Reflect.getMetadata(PATH_METADATA, getPlanPageHandler)).toBe(
      'plan/page',
    )
    expect(Reflect.getMetadata(PATH_METADATA, getPlanDetailHandler)).toBe(
      'plan/detail',
    )
    expect(Reflect.getMetadata(PATH_METADATA, createPlanHandler)).toBe(
      'plan/create',
    )
    expect(Reflect.getMetadata(PATH_METADATA, updatePlanHandler)).toBe(
      'plan/update',
    )
    expect(Reflect.getMetadata(PATH_METADATA, updatePlanStatusHandler)).toBe(
      'plan/update-status',
    )
    expect(
      Reflect.getMetadata(PATH_METADATA, getReconciliationPageHandler),
    ).toBe('reconciliation/page')
    expect(Reflect.getMetadata(PATH_METADATA, repairRewardHandler)).toBe(
      'reconciliation/repair',
    )
  })

  it('records audit metadata for plan mutations and reward repair', () => {
    const createPlanHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'createPlan',
    )?.value
    const updatePlanHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'updatePlan',
    )?.value
    const updatePlanStatusHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'updatePlanStatus',
    )?.value
    const repairRewardHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'repairReward',
    )?.value

    expect(
      Reflect.getMetadata('audit', createPlanHandler),
    ).toEqual({
      actionType: AuditActionTypeEnum.CREATE,
      content: '创建签到计划',
    })

    expect(
      Reflect.getMetadata('audit', updatePlanHandler),
    ).toEqual({
      actionType: AuditActionTypeEnum.UPDATE,
      content: '更新签到计划',
    })

    expect(
      Reflect.getMetadata('audit', updatePlanStatusHandler),
    ).toEqual({
      actionType: AuditActionTypeEnum.UPDATE,
      content: '更新签到计划状态',
    })

    expect(
      Reflect.getMetadata('audit', repairRewardHandler),
    ).toEqual({
      actionType: AuditActionTypeEnum.UPDATE,
      content: '补偿签到奖励',
    })
  })
})
