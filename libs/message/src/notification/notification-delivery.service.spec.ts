import type { DrizzleService } from '@db/core'
import { BadRequestException } from '@nestjs/common'
import { MessageNotificationDeliveryService } from './notification-delivery.service'

function createDrizzleStub() {
  const insertBuilder = {
    values: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockResolvedValue({ rowCount: 1 }),
  }
  const countBuilder = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
  }
  const rowsBuilder = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn(),
  }

  return {
    withErrorHandling: jest
      .fn()
      .mockImplementation(async (handler) => handler()),
    db: {
      insert: jest.fn().mockReturnValue(insertBuilder),
      select: jest
        .fn()
        .mockReturnValueOnce(countBuilder)
        .mockReturnValueOnce(rowsBuilder),
    },
    schema: {
      notificationDelivery: {
        id: 'id',
        status: 'status',
        categoryKey: 'categoryKey',
        eventKey: 'eventKey',
        receiverUserId: 'receiverUserId',
        projectionKey: 'projectionKey',
        eventId: 'eventId',
        dispatchId: 'dispatchId',
      },
    },
    insertBuilder,
    countBuilder,
    rowsBuilder,
  } as unknown as DrizzleService
}

describe('messageNotificationDeliveryService', () => {
  it('throws 400 for invalid eventId filter', async () => {
    const service = new MessageNotificationDeliveryService(createDrizzleStub())

    await expect(
      service.getNotificationDeliveryPage({
        eventId: 'abc',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('throws 400 for invalid dispatchId filter', async () => {
    const service = new MessageNotificationDeliveryService(createDrizzleStub())

    await expect(
      service.getNotificationDeliveryPage({
        dispatchId: '-1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('stores task reminder lookup columns from event payload', async () => {
    const drizzle = createDrizzleStub() as DrizzleService & {
      insertBuilder: {
        values: jest.Mock
        onConflictDoUpdate: jest.Mock
      }
      withErrorHandling: jest.Mock
      db: Record<string, unknown>
    }
    drizzle.db.insert = jest.fn().mockReturnValue(drizzle.insertBuilder)

    const service = new MessageNotificationDeliveryService(drizzle)

    await service.recordHandledDispatch(
      {
        id: 1n,
        eventKey: 'task.reminder.reward_granted',
        domain: 'message',
        idempotencyKey: 'k',
        subjectType: 'user',
        subjectId: 1,
        targetType: 'task',
        targetId: 9,
        operatorId: null,
        occurredAt: new Date('2026-04-18T00:00:00.000Z'),
        createdAt: new Date('2026-04-18T00:00:00.000Z'),
        context: {
          projectionKey: 'task:reminder:reward:assignment:10',
          payload: {
            object: {
              id: 9,
            },
            reminder: {
              assignmentId: 10,
              kind: 'reward_granted',
            },
          },
        },
      } as never,
      {
        id: 2n,
        eventId: 1n,
        consumer: 'notification',
        status: 0,
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
        processedAt: null,
        createdAt: new Date('2026-04-18T00:00:00.000Z'),
        updatedAt: new Date('2026-04-18T00:00:00.000Z'),
      } as never,
      {
        action: 'append',
        receiverUserId: 7,
        projectionKey: 'task:reminder:reward:assignment:10',
        notification: {
          id: 3,
          categoryKey: 'task_reminder',
          projectionKey: 'task:reminder:reward:assignment:10',
          receiverUserId: 7,
        },
      },
    )

    expect(drizzle.insertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 9,
        assignmentId: 10,
        reminderKind: 'reward_granted',
      }),
    )
  })

  it('rejects task reminder delivery records without typed lookup facts', async () => {
    const drizzle = createDrizzleStub() as DrizzleService & {
      insertBuilder: {
        values: jest.Mock
        onConflictDoUpdate: jest.Mock
      }
      db: Record<string, unknown>
    }
    drizzle.db.insert = jest.fn().mockReturnValue(drizzle.insertBuilder)

    const service = new MessageNotificationDeliveryService(drizzle)

    await expect(
      service.recordHandledDispatch(
        {
          id: 1n,
          eventKey: 'task.reminder.reward_granted',
          domain: 'message',
          idempotencyKey: 'k',
          subjectType: 'user',
          subjectId: 1,
          targetType: 'task',
          targetId: 9,
          operatorId: null,
          occurredAt: new Date('2026-04-18T00:00:00.000Z'),
          createdAt: new Date('2026-04-18T00:00:00.000Z'),
          context: {
            projectionKey: 'task:reminder:reward:assignment:10',
            payload: {
              object: {
                kind: 'task',
              },
              reminder: {
                kind: 'reward_granted',
              },
            },
          },
        } as never,
        {
          id: 2n,
          eventId: 1n,
          consumer: 'notification',
          status: 0,
          retryCount: 0,
          nextRetryAt: null,
          lastError: null,
          processedAt: null,
          createdAt: new Date('2026-04-18T00:00:00.000Z'),
          updatedAt: new Date('2026-04-18T00:00:00.000Z'),
        } as never,
        {
          action: 'append',
          receiverUserId: 7,
          projectionKey: 'task:reminder:reward:assignment:10',
          notification: {
            id: 3,
            categoryKey: 'task_reminder',
            projectionKey: 'task:reminder:reward:assignment:10',
            receiverUserId: 7,
          },
        },
      ),
    ).rejects.toThrow(
      'task_reminder delivery must provide taskId, assignmentId and reminderKind typed lookup facts',
    )
  })

  it('uses exact projectionKey matching in query filters', async () => {
    const drizzle = createDrizzleStub() as DrizzleService & {
      countBuilder: {
        where: jest.Mock
      }
      rowsBuilder: {
        where: jest.Mock
        orderBy: jest.Mock
        limit: jest.Mock
        offset: jest.Mock
      }
    }
    drizzle.countBuilder.where.mockResolvedValue([{ count: 0 }])
    drizzle.rowsBuilder.offset.mockResolvedValue([])

    const service = new MessageNotificationDeliveryService(drizzle)

    await service.getNotificationDeliveryPage({
      projectionKey: 'announcement:notify:42:user:7',
    } as never)

    expect(drizzle.countBuilder.where).toHaveBeenCalledTimes(1)
    expect(drizzle.rowsBuilder.where).toHaveBeenCalledTimes(1)
  })
})
