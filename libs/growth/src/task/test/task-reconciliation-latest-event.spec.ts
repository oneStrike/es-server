import * as schema from '@db/schema'
import { TaskExecutionService } from '../task-execution.service'

interface TaskEventProgressRow {
  assignmentId: number
  eventCode: number | null
  eventBizKey: string | null
  eventOccurredAt: Date | null
  id: number
}

describe('task reconciliation latest event', () => {
  function createService(rows: TaskEventProgressRow[]) {
    const queryResult = Object.assign(Promise.resolve(rows), {
      orderBy: jest.fn().mockResolvedValue(rows),
    })
    const where = jest.fn().mockReturnValue(queryResult)
    const from = jest.fn().mockReturnValue({ where })
    const select = jest.fn().mockReturnValue({ from })

    const service = new TaskExecutionService(
      {
        db: { select },
        schema,
      } as never,
      {} as never,
      {} as never,
    )

    return {
      service,
      select,
      from,
      where,
      queryResult,
    }
  }

  it('旧事件晚写入时仍按 eventOccurredAt 选择真正较新的事件', async () => {
    const { service } = createService([
      {
        assignmentId: 11,
        eventCode: 101,
        eventBizKey: 'older-written-later',
        eventOccurredAt: new Date('2026-04-15T08:00:00.000Z'),
        id: 20,
      },
      {
        assignmentId: 11,
        eventCode: 102,
        eventBizKey: 'newer-business-event',
        eventOccurredAt: new Date('2026-04-15T09:00:00.000Z'),
        id: 10,
      },
    ])

    const result = await (service as any).getAssignmentEventProgressMap([11])

    expect(result.get(11)).toEqual({
      eventCode: 102,
      eventBizKey: 'newer-business-event',
      eventOccurredAt: new Date('2026-04-15T09:00:00.000Z'),
    })
  })

  it('eventOccurredAt 相同时按更大的日志 id 作为稳定兜底', async () => {
    const sameOccurredAt = new Date('2026-04-15T09:00:00.000Z')
    const { service } = createService([
      {
        assignmentId: 22,
        eventCode: 201,
        eventBizKey: 'same-time-lower-id',
        eventOccurredAt: sameOccurredAt,
        id: 5,
      },
      {
        assignmentId: 22,
        eventCode: 202,
        eventBizKey: 'same-time-higher-id',
        eventOccurredAt: sameOccurredAt,
        id: 9,
      },
    ])

    const result = await (service as any).getAssignmentEventProgressMap([22])

    expect(result.get(22)).toEqual({
      eventCode: 202,
      eventBizKey: 'same-time-higher-id',
      eventOccurredAt: sameOccurredAt,
    })
  })

  it('存在 eventOccurredAt 时优先于空时间记录', async () => {
    const { service } = createService([
      {
        assignmentId: 33,
        eventCode: 301,
        eventBizKey: 'missing-occurred-at',
        eventOccurredAt: null,
        id: 18,
      },
      {
        assignmentId: 33,
        eventCode: 302,
        eventBizKey: 'has-occurred-at',
        eventOccurredAt: new Date('2026-04-15T10:00:00.000Z'),
        id: 3,
      },
    ])

    const result = await (service as any).getAssignmentEventProgressMap([33])

    expect(result.get(33)).toEqual({
      eventCode: 302,
      eventBizKey: 'has-occurred-at',
      eventOccurredAt: new Date('2026-04-15T10:00:00.000Z'),
    })
  })

  it('多 assignment 混合乱序时会分别选出各自按发生时间定义的最新事件', async () => {
    const { service } = createService([
      {
        assignmentId: 41,
        eventCode: 401,
        eventBizKey: 'a-older-written-later',
        eventOccurredAt: new Date('2026-04-15T07:00:00.000Z'),
        id: 30,
      },
      {
        assignmentId: 42,
        eventCode: 501,
        eventBizKey: 'b-no-time',
        eventOccurredAt: null,
        id: 40,
      },
      {
        assignmentId: 41,
        eventCode: 402,
        eventBizKey: 'a-newer-business-event',
        eventOccurredAt: new Date('2026-04-15T08:00:00.000Z'),
        id: 11,
      },
      {
        assignmentId: 42,
        eventCode: 502,
        eventBizKey: 'b-has-time',
        eventOccurredAt: new Date('2026-04-15T06:30:00.000Z'),
        id: 4,
      },
    ])

    const result = await (service as any).getAssignmentEventProgressMap([41, 42])

    expect(result.get(41)).toEqual({
      eventCode: 402,
      eventBizKey: 'a-newer-business-event',
      eventOccurredAt: new Date('2026-04-15T08:00:00.000Z'),
    })
    expect(result.get(42)).toEqual({
      eventCode: 502,
      eventBizKey: 'b-has-time',
      eventOccurredAt: new Date('2026-04-15T06:30:00.000Z'),
    })
  })
})
