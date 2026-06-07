/// <reference types="jest" />

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(() => 'task-event-failure-token'),
}))

import * as schema from '@db/schema'
import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type'
import { TaskEventFailureService } from './task-event-failure.service'
import { TaskEventFailureStatusEnum } from './task.constant'

function createThenableBuilder<TResult>(
  result: TResult,
  recorder: Record<string, ReturnType<typeof jest.fn>> = {},
) {
  const builder: Record<string, ReturnType<typeof jest.fn>> & {
    then: Promise<TResult>['then']
    catch: Promise<TResult>['catch']
    finally: Promise<TResult>['finally']
  } = {
    from: jest.fn(() => builder),
    where: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    offset: jest.fn(() => Promise.resolve(result)),
    values: jest.fn(() => builder),
    set: jest.fn(() => builder),
    onConflictDoUpdate: jest.fn(() => Promise.resolve(result)),
    returning: jest.fn(() => Promise.resolve(result)),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    catch: Promise.resolve(result).catch.bind(Promise.resolve(result)),
    finally: Promise.resolve(result).finally.bind(Promise.resolve(result)),
  }

  Object.assign(recorder, builder)
  return builder
}

function createService() {
  const db = {
    insert: jest.fn(() => createThenableBuilder([])),
    update: jest.fn(() => createThenableBuilder([])),
    select: jest.fn(() => createThenableBuilder([])),
    execute: jest.fn(),
  }
  const drizzle = {
    schema,
    db,
    buildPage: jest.fn(() => ({
      pageIndex: 1,
      pageSize: 20,
      limit: 20,
      offset: 0,
    })),
  }
  const execution = {
    consumeEventProgress: jest.fn(),
  }
  const registry = {
    getTemplateByEventCode: jest.fn(() => ({
      templateKey: 'COMIC_WORK_VIEW',
    })),
  }
  const service = new TaskEventFailureService(
    drizzle as any,
    execution as any,
    registry as any,
  )

  return { service, db, execution, registry }
}

function createPayload() {
  return {
    bizKey: 'view:comic:1:user:10001',
    source: 'comic',
    eventEnvelope: {
      code: 100,
      key: 'COMIC_WORK_VIEW',
      subjectType: 'user',
      subjectId: 10001,
      targetType: 'comic_work',
      targetId: 1,
      occurredAt: new Date('2026-06-08T00:00:00.000Z'),
      governanceStatus: EventEnvelopeGovernanceStatusEnum.NONE,
      context: { targetType: 'comic_work' },
    },
  } as any
}

describe('TaskEventFailureService', () => {
  it('records task consumer failures idempotently', async () => {
    const { service, db } = createService()
    const recorder: Record<string, ReturnType<typeof jest.fn>> = {}
    ;(db as any).insert = jest.fn(() => createThenableBuilder([], recorder))

    await service.recordTaskEventFailure({
      payload: createPayload(),
      errorMessage: 'task consumer failed',
    })

    const values = recorder.values.mock.calls[0]?.[0]
    const conflict = recorder.onConflictDoUpdate.mock.calls[0]?.[0]
    expect(values).toEqual(
      expect.objectContaining({
        idempotencyKey: 'task:event:COMIC_WORK_VIEW:view:comic:1:user:10001',
        status: TaskEventFailureStatusEnum.PENDING,
        eventCode: 100,
        templateKey: 'COMIC_WORK_VIEW',
      }),
    )
    expect(conflict.target).toBe(schema.taskEventFailure.idempotencyKey)
  })

  it('retries failures through the task execution path and resolves the fact', async () => {
    const { service, db, execution } = createService()
    const claim = {
      id: 88,
      retryCount: 0,
      processingToken: 'task-event-failure-token',
      requestPayload: createPayload(),
    }
    ;(db as any).update = jest
      .fn()
      .mockReturnValueOnce(createThenableBuilder([claim]))
      .mockReturnValueOnce(createThenableBuilder([]))
    execution.consumeEventProgress.mockResolvedValue({
      matchedTaskIds: [1],
      progressedInstanceIds: [2],
      completedInstanceIds: [],
      duplicateInstanceIds: [],
    })

    const result = await service.retryTaskEventFailure(88)

    expect(execution.consumeEventProgress).toHaveBeenCalledWith({
      eventEnvelope: expect.objectContaining({
        key: 'COMIC_WORK_VIEW',
      }),
      bizKey: 'view:comic:1:user:10001',
    })
    expect(result).toEqual({
      failureId: 88,
      status: TaskEventFailureStatusEnum.RESOLVED,
      retryCount: 1,
      message: '任务事件消费重试成功',
    })
  })
})
