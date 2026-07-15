import type { DbTransaction } from '@db/core'
import type { CouponAdminGrantItemSelect } from '@db/schema'
import type {
  WorkflowExecuteContext,
  WorkflowExpiredAttemptRecoveryContext,
  WorkflowHandler,
  WorkflowItemPageContext,
  WorkflowRetryContext,
} from '@libs/workflow/workflow/workflow.type'
import type {
  CouponAdminGrantItemCounters,
  GrantCouponsForSourceInput,
} from './types/coupon.type'
import { acquireIntegrityLocks, DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { WorkflowCancellationError } from '@libs/workflow/workflow/workflow-cancellation'
import {
  WorkflowAttemptStatusEnum,
  WorkflowEventTypeEnum,
} from '@libs/workflow/workflow/workflow.constant'
import { WorkflowRegistry } from '@libs/workflow/workflow/workflow.registry'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { CouponAdminGrantWorkflowService } from './coupon-admin-grant-workflow.service'
import {
  CouponAdminGrantItemStatusEnum,
  CouponSourceTypeEnum,
  CouponWorkflowType,
} from './coupon.constant'
import { CouponService } from './coupon.service'

const EXECUTION_CHUNK_SIZE = 50

type CouponAdminGrantExecutionItem = Pick<
  CouponAdminGrantItemSelect,
  'id' | 'itemId' | 'userId'
>

type CouponAdminGrantRunningItem = Pick<
  CouponAdminGrantItemSelect,
  'id' | 'userId'
>

@Injectable()
export class CouponAdminGrantWorkflowHandler
  implements OnModuleInit, WorkflowHandler
{
  readonly workflowType = CouponWorkflowType.ADMIN_GRANT_BATCH
  readonly workflowLabel = '批量发券'
  readonly workflowDescription = '后台批量发放优惠券'

  // 初始化批量发券 workflow handler 依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly registry: WorkflowRegistry,
    private readonly couponService: CouponService,
    private readonly grantWorkflowService: CouponAdminGrantWorkflowService,
  ) {}

  // 注册工作流处理器。
  onModuleInit() {
    this.registry.register(this)
  }

  // 执行批量发券 attempt。
  async execute(context: WorkflowExecuteContext) {
    const { grantJob } =
      await this.grantWorkflowService.readGrantJobByWorkflowJobId(context.jobId)
    let attemptCounters = this.emptyCounters()

    while (true) {
      await context.assertStillOwned()
      if (await context.isCancelRequested()) {
        const cancellation =
          await this.grantWorkflowService.markUnprocessedItemsSkipped(
            grantJob.id,
            context.attemptNo,
          )
        throw new WorkflowCancellationError({
          jobCounters: cancellation.counters,
          attemptCounters: {
            ...attemptCounters,
            skippedItemCount:
              attemptCounters.skippedItemCount + cancellation.skippedItemCount,
          },
        })
      }

      const items = await this.listExecutableItems(grantJob.id)
      if (items.length === 0) {
        break
      }

      for (const item of items) {
        await context.assertStillOwned()
        if (await context.isCancelRequested()) {
          const cancellation =
            await this.grantWorkflowService.markUnprocessedItemsSkipped(
              grantJob.id,
              context.attemptNo,
            )
          throw new WorkflowCancellationError({
            jobCounters: cancellation.counters,
            attemptCounters: {
              ...attemptCounters,
              skippedItemCount:
                attemptCounters.skippedItemCount +
                cancellation.skippedItemCount,
            },
          })
        }

        const result = await this.processItem(grantJob, item, context.attemptNo)
        if (!result.claimed) {
          continue
        }
        attemptCounters = {
          successItemCount:
            attemptCounters.successItemCount + (result.success ? 1 : 0),
          failedItemCount:
            attemptCounters.failedItemCount + (result.success ? 0 : 1),
          skippedItemCount: attemptCounters.skippedItemCount,
        }
        await context.appendEvent(
          result.success
            ? WorkflowEventTypeEnum.ITEM_SUCCEEDED
            : WorkflowEventTypeEnum.ITEM_FAILED,
          result.success
            ? 'COUPON_ADMIN_GRANT_ITEM_SUCCEEDED'
            : 'COUPON_ADMIN_GRANT_ITEM_FAILED',
          {
            itemId: item.itemId,
            userId: item.userId,
            createdCount: result.createdCount,
          },
        )
      }

      const jobCounters = await this.grantWorkflowService.aggregateCounters(
        grantJob.id,
      )
      const completedItemCount =
        jobCounters.successItemCount +
        jobCounters.failedItemCount +
        jobCounters.skippedItemCount
      await context.updateProgress({
        percent: Math.floor(
          (completedItemCount / Math.max(grantJob.selectedUserCount, 1)) * 100,
        ),
        context: {
          completedItemCount,
          selectedItemCount: grantJob.selectedUserCount,
        },
        counters: jobCounters,
      })
    }

    const jobCounters = await this.grantWorkflowService.aggregateCounters(
      grantJob.id,
    )
    await context.completeAttempt({
      status:
        attemptCounters.failedItemCount > 0
          ? WorkflowAttemptStatusEnum.PARTIAL_FAILED
          : WorkflowAttemptStatusEnum.SUCCESS,
      jobCounters,
      attemptCounters,
    })
  }

  // 校验人工重试条目。
  async validateRetry(context: WorkflowRetryContext) {
    if (context.selectedItemIds.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '重试条目不能为空',
      )
    }
    const { grantJob } =
      await this.grantWorkflowService.readGrantJobByWorkflowJobId(context.jobId)
    const rows = await this.drizzle.db
      .select({ itemId: this.drizzle.schema.couponAdminGrantItem.itemId })
      .from(this.drizzle.schema.couponAdminGrantItem)
      .where(
        and(
          eq(
            this.drizzle.schema.couponAdminGrantItem.couponAdminGrantJobId,
            grantJob.id,
          ),
          inArray(
            this.drizzle.schema.couponAdminGrantItem.itemId,
            context.selectedItemIds,
          ),
          eq(
            this.drizzle.schema.couponAdminGrantItem.status,
            CouponAdminGrantItemStatusEnum.FAILED,
          ),
        ),
      )
    if (rows.length !== new Set(context.selectedItemIds).size) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '只能重试当前任务下的失败发券用户',
      )
    }
  }

  // 准备人工重试。
  async prepareRetry(
    context: WorkflowRetryContext,
    nextAttemptNo: number,
    tx: DbTransaction,
  ) {
    const { grantJob } =
      await this.grantWorkflowService.readGrantJobByWorkflowJobId(
        context.jobId,
        tx,
      )
    await tx
      .update(this.drizzle.schema.couponAdminGrantItem)
      .set({
        status: CouponAdminGrantItemStatusEnum.RETRYING,
        currentAttemptNo: nextAttemptNo,
        lastError: null,
        lastFailedAt: null,
        nextRetryAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(
            this.drizzle.schema.couponAdminGrantItem.couponAdminGrantJobId,
            grantJob.id,
          ),
          inArray(
            this.drizzle.schema.couponAdminGrantItem.itemId,
            context.selectedItemIds,
          ),
          eq(
            this.drizzle.schema.couponAdminGrantItem.status,
            CouponAdminGrantItemStatusEnum.FAILED,
          ),
        ),
      )
    return {
      jobCounters: await this.grantWorkflowService.aggregateCounters(
        grantJob.id,
        tx,
      ),
    }
  }

  // 恢复过期 RUNNING attempt。
  async recoverExpiredAttempt(
    context: WorkflowExpiredAttemptRecoveryContext,
    nextAttemptNo: number,
    tx: DbTransaction,
  ) {
    const { grantJob } =
      await this.grantWorkflowService.readGrantJobByWorkflowJobId(
        context.jobId,
        tx,
      )
    const runningItems = await tx
      .select({
        id: this.drizzle.schema.couponAdminGrantItem.id,
        userId: this.drizzle.schema.couponAdminGrantItem.userId,
      })
      .from(this.drizzle.schema.couponAdminGrantItem)
      .where(
        and(
          eq(
            this.drizzle.schema.couponAdminGrantItem.couponAdminGrantJobId,
            grantJob.id,
          ),
          eq(
            this.drizzle.schema.couponAdminGrantItem.status,
            CouponAdminGrantItemStatusEnum.RUNNING,
          ),
          eq(
            this.drizzle.schema.couponAdminGrantItem.currentAttemptNo,
            context.expiredAttemptNo,
          ),
        ),
      )
    const reconciledCounters = await this.reconcileExpiredRunningItems(
      {
        couponDefinitionId: grantJob.couponDefinitionId,
        id: grantJob.id,
        operationHash: grantJob.operationHash,
        perUserQuantity: grantJob.perUserQuantity,
      },
      runningItems,
      nextAttemptNo,
      tx,
    )
    const recoverableItems = await tx
      .select({
        currentAttemptNo:
          this.drizzle.schema.couponAdminGrantItem.currentAttemptNo,
        id: this.drizzle.schema.couponAdminGrantItem.id,
      })
      .from(this.drizzle.schema.couponAdminGrantItem)
      .where(
        and(
          eq(
            this.drizzle.schema.couponAdminGrantItem.couponAdminGrantJobId,
            grantJob.id,
          ),
          inArray(this.drizzle.schema.couponAdminGrantItem.status, [
            CouponAdminGrantItemStatusEnum.PENDING,
            CouponAdminGrantItemStatusEnum.RETRYING,
          ]),
        ),
      )
    const recoverableIds = recoverableItems
      .filter(
        (item) =>
          item.currentAttemptNo === null ||
          item.currentAttemptNo === context.expiredAttemptNo,
      )
      .map((item) => item.id)
    if (recoverableIds.length > 0) {
      await tx
        .update(this.drizzle.schema.couponAdminGrantItem)
        .set({
          status: CouponAdminGrantItemStatusEnum.RETRYING,
          currentAttemptNo: nextAttemptNo,
          updatedAt: new Date(),
        })
        .where(
          inArray(this.drizzle.schema.couponAdminGrantItem.id, recoverableIds),
        )
    }
    const jobCounters = await this.grantWorkflowService.aggregateCounters(
      grantJob.id,
      tx,
    )
    return {
      selectedItemCount: runningItems.length + recoverableIds.length,
      jobCounters,
      attemptCounters: reconciledCounters,
      recoverableItemCount:
        reconciledCounters.recoverableItemCount + recoverableIds.length,
    }
  }

  // 读取 workflow 通用条目分页。
  async getItemPage(context: WorkflowItemPageContext) {
    return this.grantWorkflowService.getItemPage({
      ...context.query,
      jobId: context.jobId,
    })
  }

  private async listExecutableItems(couponAdminGrantJobId: number) {
    return this.drizzle.db
      .select({
        id: this.drizzle.schema.couponAdminGrantItem.id,
        itemId: this.drizzle.schema.couponAdminGrantItem.itemId,
        userId: this.drizzle.schema.couponAdminGrantItem.userId,
      })
      .from(this.drizzle.schema.couponAdminGrantItem)
      .where(
        and(
          eq(
            this.drizzle.schema.couponAdminGrantItem.couponAdminGrantJobId,
            couponAdminGrantJobId,
          ),
          inArray(this.drizzle.schema.couponAdminGrantItem.status, [
            CouponAdminGrantItemStatusEnum.PENDING,
            CouponAdminGrantItemStatusEnum.RETRYING,
          ]),
        ),
      )
      .orderBy(
        asc(this.drizzle.schema.couponAdminGrantItem.updatedAt),
        asc(this.drizzle.schema.couponAdminGrantItem.id),
      )
      .limit(EXECUTION_CHUNK_SIZE)
  }

  private async processItem(
    grantJob: {
      couponDefinitionId: number
      id: number
      operationHash: string
      perUserQuantity: number
    },
    item: CouponAdminGrantExecutionItem,
    attemptNo: number,
  ) {
    const grantKeys = this.grantWorkflowService.buildGrantKeys({
      operationHash: grantJob.operationHash,
      quantity: grantJob.perUserQuantity,
      userId: item.userId,
    })
    const grantInput: GrantCouponsForSourceInput = {
      userId: item.userId,
      couponDefinitionId: grantJob.couponDefinitionId,
      sourceType: CouponSourceTypeEnum.ADMIN_GRANT,
      sourceId: grantJob.id,
      quantity: grantJob.perUserQuantity,
      grantKeys,
    }
    const lockRequests =
      this.couponService.buildGrantParentLockRequests(grantInput)

    return this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, lockRequests)
        const now = new Date()
        const [runningItem] = await tx
          .update(this.drizzle.schema.couponAdminGrantItem)
          .set({
            status: CouponAdminGrantItemStatusEnum.RUNNING,
            currentAttemptNo: attemptNo,
            updatedAt: now,
          })
          .where(
            and(
              eq(this.drizzle.schema.couponAdminGrantItem.id, item.id),
              inArray(this.drizzle.schema.couponAdminGrantItem.status, [
                CouponAdminGrantItemStatusEnum.PENDING,
                CouponAdminGrantItemStatusEnum.RETRYING,
              ]),
            ),
          )
          .returning()
        if (!runningItem) {
          return { claimed: false, success: false, createdCount: 0 }
        }

        try {
          const result =
            await this.couponService.grantCouponsForSourceAfterLocks(
              tx,
              grantInput,
            )
          await tx
            .update(this.drizzle.schema.couponAdminGrantItem)
            .set({
              status: CouponAdminGrantItemStatusEnum.SUCCESS,
              createdCount: result.createdCount,
              lastError: null,
              lastFailedAt: null,
              nextRetryAt: null,
              updatedAt: new Date(),
            })
            .where(eq(this.drizzle.schema.couponAdminGrantItem.id, item.id))
          return {
            claimed: true,
            success: true,
            createdCount: result.createdCount,
          }
        } catch (error) {
          const errorFacts = this.toErrorFacts(error, item)
          await tx
            .update(this.drizzle.schema.couponAdminGrantItem)
            .set({
              status: CouponAdminGrantItemStatusEnum.FAILED,
              failureCount: sql`${this.drizzle.schema.couponAdminGrantItem.failureCount} + 1`,
              lastError: errorFacts,
              lastFailedAt: new Date(),
              nextRetryAt: null,
              updatedAt: new Date(),
            })
            .where(eq(this.drizzle.schema.couponAdminGrantItem.id, item.id))
          return { claimed: true, success: false, createdCount: 0 }
        }
      },
    })
  }

  private async reconcileExpiredRunningItems(
    grantJob: {
      couponDefinitionId: number
      id: number
      operationHash: string
      perUserQuantity: number
    },
    runningItems: CouponAdminGrantRunningItem[],
    nextAttemptNo: number,
    tx: DbTransaction,
  ) {
    const counters = {
      ...this.emptyCounters(),
      recoverableItemCount: 0,
    }
    for (const item of runningItems) {
      const grantKeys = this.grantWorkflowService.buildGrantKeys({
        operationHash: grantJob.operationHash,
        quantity: grantJob.perUserQuantity,
        userId: item.userId,
      })
      const existingRows = await tx
        .select({ grantKey: this.drizzle.schema.userCouponInstance.grantKey })
        .from(this.drizzle.schema.userCouponInstance)
        .where(
          and(
            eq(this.drizzle.schema.userCouponInstance.userId, item.userId),
            eq(
              this.drizzle.schema.userCouponInstance.couponDefinitionId,
              grantJob.couponDefinitionId,
            ),
            eq(
              this.drizzle.schema.userCouponInstance.sourceType,
              CouponSourceTypeEnum.ADMIN_GRANT,
            ),
            eq(this.drizzle.schema.userCouponInstance.sourceId, grantJob.id),
            inArray(this.drizzle.schema.userCouponInstance.grantKey, grantKeys),
          ),
        )
      if (existingRows.length === grantKeys.length) {
        counters.successItemCount += 1
        await tx
          .update(this.drizzle.schema.couponAdminGrantItem)
          .set({
            status: CouponAdminGrantItemStatusEnum.SUCCESS,
            createdCount: existingRows.length,
            lastError: null,
            lastFailedAt: null,
            nextRetryAt: null,
            updatedAt: new Date(),
          })
          .where(eq(this.drizzle.schema.couponAdminGrantItem.id, item.id))
        continue
      }

      counters.recoverableItemCount += 1
      await tx
        .update(this.drizzle.schema.couponAdminGrantItem)
        .set({
          status: CouponAdminGrantItemStatusEnum.RETRYING,
          currentAttemptNo: nextAttemptNo,
          updatedAt: new Date(),
        })
        .where(eq(this.drizzle.schema.couponAdminGrantItem.id, item.id))
    }
    return counters
  }

  private toErrorFacts(error: unknown, item: CouponAdminGrantExecutionItem) {
    return {
      code: 'COUPON_ADMIN_GRANT_ITEM_FAILED',
      context: {
        itemId: item.itemId,
        userId: item.userId,
        message: error instanceof Error ? error.message : '发券失败',
      },
      domain: 'coupon',
      retryable: true,
      severity: 'error',
      stage: 'grant-user',
    }
  }

  private emptyCounters(): CouponAdminGrantItemCounters {
    return {
      successItemCount: 0,
      failedItemCount: 0,
      skippedItemCount: 0,
    }
  }
}
