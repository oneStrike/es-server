import {
  getTaskTypeFilterValues,
  normalizeTaskType,
  TaskTypeEnum,
} from '../task.constant'

describe('task type compatibility', () => {
  it('falls back unknown legacy task types to onboarding', () => {
    expect(normalizeTaskType(3)).toBe(TaskTypeEnum.ONBOARDING)
    expect(normalizeTaskType(5)).toBe(TaskTypeEnum.ONBOARDING)
  })

  it('only queries stable task scene values', () => {
    expect(getTaskTypeFilterValues(TaskTypeEnum.DAILY)).toEqual([
      TaskTypeEnum.DAILY,
    ])
    expect(getTaskTypeFilterValues(TaskTypeEnum.CAMPAIGN)).toEqual([
      TaskTypeEnum.CAMPAIGN,
    ])
  })
})
