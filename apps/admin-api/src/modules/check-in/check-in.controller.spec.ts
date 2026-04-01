import { AuditActionTypeEnum } from '../system/audit/audit.constant'
import { CheckInController } from './check-in.controller'

describe('admin CheckInController audit metadata', () => {
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
    const publishPlanHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'publishPlan',
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
      Reflect.getMetadata('audit', publishPlanHandler),
    ).toEqual({
      actionType: AuditActionTypeEnum.UPDATE,
      content: '发布签到计划',
    })

    expect(
      Reflect.getMetadata('audit', repairRewardHandler),
    ).toEqual({
      actionType: AuditActionTypeEnum.UPDATE,
      content: '补偿签到奖励',
    })
  })
})
