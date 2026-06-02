/// <reference types="jest" />

import { WorkflowAttemptStatusEnum } from '@libs/platform/modules/workflow/workflow.constant'
import { WorkflowCancellationError } from '@libs/platform/modules/workflow/workflow-cancellation'
import {
  CouponAdminGrantItemStatusEnum,
  CouponSourceTypeEnum,
} from './coupon.constant'
import { CouponAdminGrantWorkflowHandler } from './coupon-admin-grant-workflow.handler'

describe('CouponAdminGrantWorkflowHandler', () => {
  it('registers itself in the workflow registry', () => {
    const registry = { register: jest.fn() }
    const handler = buildHandler({ registry })

    handler.onModuleInit()

    expect(registry.register).toHaveBeenCalledWith(handler)
  })

  it('processes each selected user independently and completes partial failures', async () => {
    const item1 = buildGrantItem({ id: 1n, itemId: 'item-1', userId: 33 })
    const item2 = buildGrantItem({ id: 2n, itemId: 'item-2', userId: 44 })
    const tx = createProcessItemTx([item1, item2])
    const couponService = {
      grantCouponsForSource: jest
        .fn()
        .mockResolvedValueOnce({ createdCount: 2, items: [] })
        .mockRejectedValueOnce(new Error('quota exhausted')),
    }
    const grantWorkflowService = createGrantWorkflowService({
      aggregateCounters: jest.fn(async () => ({
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      readGrantJobByWorkflowJobId: jest.fn(async () => ({
        grantJob: buildGrantJob(),
      })),
    })
    const handler = buildHandler({
      couponService,
      drizzle: {
        schema,
        withTransaction: jest.fn((callback) => callback(tx)),
      },
      grantWorkflowService,
    }) as any
    handler.listExecutableItems = jest
      .fn()
      .mockResolvedValueOnce([item1, item2])
      .mockResolvedValueOnce([])
    const context = createExecuteContext()

    await handler.execute(context)

    expect(couponService.grantCouponsForSource).toHaveBeenNthCalledWith(
      1,
      tx,
      expect.objectContaining({
        grantKeys: [
          'adminGrant:operation-hash:u:33:n:0',
          'adminGrant:operation-hash:u:33:n:1',
        ],
        quantity: 2,
        sourceId: 10,
        sourceType: CouponSourceTypeEnum.ADMIN_GRANT,
        userId: 33,
      }),
    )
    expect(couponService.grantCouponsForSource).toHaveBeenNthCalledWith(
      2,
      tx,
      expect.objectContaining({ userId: 44 }),
    )
    expect(context.completeAttempt).toHaveBeenCalledWith({
      attemptCounters: {
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      jobCounters: {
        failedItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      status: WorkflowAttemptStatusEnum.PARTIAL_FAILED,
    })
    expect(context.appendEvent).toHaveBeenCalledTimes(2)
  })

  it('marks unprocessed users as skipped when cancellation is requested', async () => {
    const grantWorkflowService = createGrantWorkflowService({
      markUnprocessedItemsSkipped: jest.fn(async () => ({
        counters: {
          failedItemCount: 0,
          skippedItemCount: 3,
          successItemCount: 0,
        },
        skippedItemCount: 3,
      })),
      readGrantJobByWorkflowJobId: jest.fn(async () => ({
        grantJob: buildGrantJob({ selectedUserCount: 3 }),
      })),
    })
    const handler = buildHandler({ grantWorkflowService }) as any
    handler.listExecutableItems = jest.fn()
    const context = createExecuteContext({
      isCancelRequested: jest.fn(async () => true),
    })

    await expect(handler.execute(context)).rejects.toMatchObject({
      attemptCounters: {
        failedItemCount: 0,
        skippedItemCount: 3,
        successItemCount: 0,
      },
      jobCounters: {
        failedItemCount: 0,
        skippedItemCount: 3,
        successItemCount: 0,
      },
    } satisfies Partial<WorkflowCancellationError>)

    expect(grantWorkflowService.markUnprocessedItemsSkipped).toHaveBeenCalledWith(
      10,
      1,
    )
    expect(handler.listExecutableItems).not.toHaveBeenCalled()
  })

  it('reconciles expired running items by exact grant keys before retrying leftovers', async () => {
    const completedItem = buildGrantItem({ id: 1n, itemId: 'item-1', userId: 33 })
    const incompleteItem = buildGrantItem({ id: 2n, itemId: 'item-2', userId: 44 })
    const pendingItem = buildGrantItem({
      currentAttemptNo: null,
      id: 3n,
      itemId: 'item-3',
      status: CouponAdminGrantItemStatusEnum.PENDING,
      userId: 55,
    })
    const tx = createRecoveryTx([
      [completedItem, incompleteItem],
      [
        { grantKey: 'adminGrant:operation-hash:u:33:n:0' },
        { grantKey: 'adminGrant:operation-hash:u:33:n:1' },
      ],
      [],
      [pendingItem],
    ])
    const grantWorkflowService = createGrantWorkflowService({
      aggregateCounters: jest.fn(async () => ({
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 1,
      })),
      readGrantJobByWorkflowJobId: jest.fn(async () => ({
        grantJob: buildGrantJob(),
      })),
    })
    const handler = buildHandler({
      drizzle: { schema },
      grantWorkflowService,
    })

    const result = await handler.recoverExpiredAttempt(
      {
        conflictKeys: [],
        expiredAttemptNo: 1,
        jobId: 'job-1',
        workflowType: 'coupon.admin-grant-batch',
      },
      2,
      tx as never,
    )

    expect(result).toEqual({
      attemptCounters: {
        failedItemCount: 0,
        recoverableItemCount: 1,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      jobCounters: {
        failedItemCount: 0,
        skippedItemCount: 0,
        successItemCount: 1,
      },
      recoverableItemCount: 2,
      selectedItemCount: 3,
    })
    expect(tx.setValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          createdCount: 2,
          status: CouponAdminGrantItemStatusEnum.SUCCESS,
        }),
        expect.objectContaining({
          currentAttemptNo: 2,
          status: CouponAdminGrantItemStatusEnum.RETRYING,
        }),
      ]),
    )
  })
})

const schema = {
  couponAdminGrantItem: {
    couponAdminGrantJobId:
      'coupon_admin_grant_item.coupon_admin_grant_job_id',
    currentAttemptNo: 'coupon_admin_grant_item.current_attempt_no',
    failureCount: 'coupon_admin_grant_item.failure_count',
    id: 'coupon_admin_grant_item.id',
    itemId: 'coupon_admin_grant_item.item_id',
    status: 'coupon_admin_grant_item.status',
    updatedAt: 'coupon_admin_grant_item.updated_at',
  },
  userCouponInstance: {
    couponDefinitionId: 'user_coupon_instance.coupon_definition_id',
    grantKey: 'user_coupon_instance.grant_key',
    sourceId: 'user_coupon_instance.source_id',
    sourceType: 'user_coupon_instance.source_type',
    userId: 'user_coupon_instance.user_id',
  },
}

function buildHandler(overrides: {
  couponService?: Record<string, unknown>
  drizzle?: Record<string, unknown>
  grantWorkflowService?: Record<string, unknown>
  registry?: Record<string, unknown>
} = {}) {
  return new CouponAdminGrantWorkflowHandler(
    {
      db: {},
      schema,
      withTransaction: jest.fn((callback) => callback({})),
      ...overrides.drizzle,
    } as never,
    (overrides.registry ?? { register: jest.fn() }) as never,
    (overrides.couponService ?? { grantCouponsForSource: jest.fn() }) as never,
    (overrides.grantWorkflowService ?? createGrantWorkflowService()) as never,
  )
}

function createGrantWorkflowService(
  overrides: Record<string, unknown> = {},
) {
  return {
    aggregateCounters: jest.fn(async () => ({
      failedItemCount: 0,
      skippedItemCount: 0,
      successItemCount: 0,
    })),
    buildGrantKeys: jest.fn((input: {
      operationHash: string
      quantity: number
      userId: number
    }) =>
      Array.from(
        { length: input.quantity },
        (_, index) =>
          `adminGrant:${input.operationHash}:u:${input.userId}:n:${index}`,
      ),
    ),
    markUnprocessedItemsSkipped: jest.fn(),
    readGrantJobByWorkflowJobId: jest.fn(async () => ({
      grantJob: buildGrantJob(),
    })),
    ...overrides,
  }
}

function buildGrantJob(overrides: Record<string, unknown> = {}) {
  return {
    couponDefinitionId: 7,
    id: 10,
    operationHash: 'operation-hash',
    perUserQuantity: 2,
    selectedUserCount: 2,
    ...overrides,
  }
}

function buildGrantItem(overrides: Record<string, unknown> = {}) {
  return {
    couponAdminGrantJobId: 10,
    createdAt: new Date('2026-06-02T00:00:00.000Z'),
    createdCount: 0,
    currentAttemptNo: 1,
    failureCount: 0,
    grantCount: 2,
    id: 1n,
    itemId: 'item-1',
    lastError: null,
    lastFailedAt: null,
    nextRetryAt: null,
    status: CouponAdminGrantItemStatusEnum.RUNNING,
    updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    userId: 33,
    ...overrides,
  }
}

function createExecuteContext(overrides: Record<string, unknown> = {}) {
  return {
    appendEvent: jest.fn(async () => 1n),
    assertNotCancelled: jest.fn(),
    assertStillOwned: jest.fn(),
    attemptId: 'attempt-1',
    attemptNo: 1,
    completeAttempt: jest.fn(),
    completeAttemptWithDelayedRetry: jest.fn(),
    getStatus: jest.fn(),
    isCancelRequested: jest.fn(async () => false),
    jobId: 'job-1',
    updateProgress: jest.fn(),
    workflowType: 'coupon.admin-grant-batch',
    ...overrides,
  }
}

function createProcessItemTx(claimedItems: unknown[]) {
  let updateIndex = 0
  return {
    update: jest.fn(() => {
      const currentIndex = updateIndex
      updateIndex += 1
      return {
        set: jest.fn(() => ({
          where: jest.fn(() => {
            if (currentIndex % 2 === 0) {
              return {
                returning: jest.fn(async () => [
                  claimedItems[Math.floor(currentIndex / 2)],
                ]),
              }
            }
            return Promise.resolve()
          }),
        })),
      }
    }),
  }
}

function createRecoveryTx(selectResults: unknown[][]) {
  const setValues: unknown[] = []
  return {
    select: jest.fn(() => createAwaitableSelect(selectResults.shift() ?? [])),
    setValues,
    update: jest.fn(() => ({
      set: jest.fn((value) => {
        setValues.push(value)
        return {
          where: jest.fn(() => Promise.resolve()),
        }
      }),
    })),
  }
}

function createAwaitableSelect(result: unknown[]) {
  const afterWhere = {
    then: (resolve: (value: unknown[]) => void) =>
      Promise.resolve(result).then(resolve),
  }
  const chain = {
    from: jest.fn(() => chain),
    where: jest.fn(() => afterWhere),
  }
  return chain
}
