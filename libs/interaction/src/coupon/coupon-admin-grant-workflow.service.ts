import type { Db } from '@db/core'
import type {
  AppUserSelect,
  CouponAdminGrantJobSelect,
  CouponDefinitionSelect,
  WorkflowJobSelect,
} from '@db/schema'
import type { CouponGrantSnapshot } from './types/coupon.type'
import { createHash, randomUUID } from 'node:crypto'
import { DrizzleService, toPageResult } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  WorkflowItemStatusEnum,
  WorkflowJobStatusEnum,
  WorkflowOperatorTypeEnum,
} from '@libs/platform/modules/workflow/workflow.constant'
import { toWorkflowJobDto } from '@libs/platform/modules/workflow/workflow.mapper'
import { WorkflowService } from '@libs/platform/modules/workflow/workflow.service'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { Injectable } from '@nestjs/common'
import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import {
  CouponAdminGrantItemStatusEnum,
  CouponTargetScopeEnum,
  CouponTypeEnum,
  CouponWorkflowType,
} from './coupon.constant'
import { CreateCouponGrantWorkflowDto } from './dto/coupon.dto'

const USER_VALIDATE_CHUNK_SIZE = 500
const ITEM_INSERT_CHUNK_SIZE = 500
const GRANT_KEY_PREFIX = 'adminGrant'

interface CouponAdminGrantErrorFacts {
  code: string
  context: Record<string, unknown>
  domain: string
  retryable: boolean
  severity: string
  stage: string
}

interface CouponAdminGrantJobCounters {
  failedItemCount: number
  skippedItemCount: number
  successItemCount: number
}

@Injectable()
export class CouponAdminGrantWorkflowService {
  // 初始化后台批量发券 workflow 服务依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly workflowService: WorkflowService,
  ) {}

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取批量发券任务表。
  private get couponAdminGrantJob() {
    return this.drizzle.schema.couponAdminGrantJob
  }

  // 读取批量发券条目表。
  private get couponAdminGrantItem() {
    return this.drizzle.schema.couponAdminGrantItem
  }

  // 读取券定义表。
  private get couponDefinition() {
    return this.drizzle.schema.couponDefinition
  }

  // 读取 APP 用户表。
  private get appUser() {
    return this.drizzle.schema.appUser
  }

  // 读取 workflowJob 表。
  private get workflowJob() {
    return this.drizzle.schema.workflowJob
  }

  // 创建后台批量发券 workflow。
  async createWorkflow(input: CreateCouponGrantWorkflowDto, operatorUserId: number) {
    const command = this.normalizeCreateCommand(input, operatorUserId)
    const existingJob = await this.readJobByOperationId(command.identity.operationId)
    if (existingJob) {
      return this.resolveExistingJob(existingJob, command.identity.payloadHash)
    }

    const preparedCommand = await this.prepareCreateCommand(command)
    const workflowJob = await this.workflowService.createDraftWithResources(
      {
        workflowType: CouponWorkflowType.ADMIN_GRANT_BATCH,
        displayName: `批量发券：${preparedCommand.couponDefinition.name} x${preparedCommand.quantity}`,
        operator: {
          type: WorkflowOperatorTypeEnum.ADMIN,
          userId: operatorUserId,
        },
        selectedItemCount: preparedCommand.userIds.length,
        summary: {
          couponDefinitionId: preparedCommand.couponDefinition.id,
          couponName: preparedCommand.couponDefinition.name,
          operatorUserId,
          perUserQuantity: preparedCommand.quantity,
          requestedGrantCount: preparedCommand.requestedGrantCount,
          selectedUserCount: preparedCommand.userIds.length,
        },
        progress: {
          percent: 0,
          context: {
            completedItemCount: 0,
            selectedItemCount: preparedCommand.userIds.length,
          },
        },
        conflictKeys: [
          this.buildOperationConflictKey(preparedCommand.identity.operationHash),
        ],
      },
      async ({ tx, workflowJob }) => {
        await this.createDomainJobWithItems(tx, workflowJob, preparedCommand)
      },
    )

    return this.workflowService.confirmDraft({ jobId: workflowJob.jobId })
  }

  // 构建后台批量发券稳定 grant key。
  buildGrantKey(input: {
    operationHash: string
    userId: number
    index: number
  }) {
    return `${GRANT_KEY_PREFIX}:${input.operationHash}:u:${input.userId}:n:${input.index}`
  }

  // 构建一个用户在本批次下的全部稳定 grant key。
  buildGrantKeys(input: {
    operationHash: string
    quantity: number
    userId: number
  }) {
    return Array.from({ length: input.quantity }, (_, index) =>
      this.buildGrantKey({
        operationHash: input.operationHash,
        userId: input.userId,
        index,
      }),)
  }

  // 读取批量发券任务和 workflow 任务。
  async readGrantJobByWorkflowJobId(jobId: string, db: Db = this.db) {
    const [row] = await db
      .select({
        grantJob: this.couponAdminGrantJob,
        workflowJob: this.workflowJob,
      })
      .from(this.couponAdminGrantJob)
      .innerJoin(
        this.workflowJob,
        eq(this.couponAdminGrantJob.workflowJobId, this.workflowJob.id),
      )
      .where(eq(this.workflowJob.jobId, jobId))
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '批量发券任务不存在',
      )
    }
    return row
  }

  // 聚合批量发券任务计数。
  async aggregateCounters(
    couponAdminGrantJobId: number,
    db: Db = this.db,
  ): Promise<CouponAdminGrantJobCounters> {
    const rows = await db
      .select({
        status: this.couponAdminGrantItem.status,
        total: count(),
      })
      .from(this.couponAdminGrantItem)
      .where(
        eq(
          this.couponAdminGrantItem.couponAdminGrantJobId,
          couponAdminGrantJobId,
        ),
      )
      .groupBy(this.couponAdminGrantItem.status)
    const statusCounts = new Map(rows.map((row) => [row.status, row.total]))
    return {
      successItemCount:
        statusCounts.get(CouponAdminGrantItemStatusEnum.SUCCESS) ?? 0,
      failedItemCount:
        statusCounts.get(CouponAdminGrantItemStatusEnum.FAILED) ?? 0,
      skippedItemCount:
        statusCounts.get(CouponAdminGrantItemStatusEnum.SKIPPED) ?? 0,
    }
  }

  // 标记未处理条目为跳过，用于取消完成。
  async markUnprocessedItemsSkipped(
    couponAdminGrantJobId: number,
    attemptNo: number,
    db: Db = this.db,
  ) {
    const now = new Date()
    const skippedRows = await db
      .update(this.couponAdminGrantItem)
      .set({
        status: CouponAdminGrantItemStatusEnum.SKIPPED,
        currentAttemptNo: attemptNo,
        updatedAt: now,
      })
      .where(
        and(
          eq(
            this.couponAdminGrantItem.couponAdminGrantJobId,
            couponAdminGrantJobId,
          ),
          inArray(this.couponAdminGrantItem.status, [
            CouponAdminGrantItemStatusEnum.PENDING,
            CouponAdminGrantItemStatusEnum.RETRYING,
          ]),
        ),
      )
      .returning({ id: this.couponAdminGrantItem.id })
    return {
      counters: await this.aggregateCounters(couponAdminGrantJobId, db),
      skippedItemCount: skippedRows.length,
    }
  }

  // 分页读取通用 workflow 条目。
  async getItemPage(input: {
    jobId: string
    orderBy?: string
    pageIndex?: number
    pageSize?: number
    status?: WorkflowItemStatusEnum
  }) {
    const { grantJob } = await this.readGrantJobByWorkflowJobId(input.jobId)
    const conditions = [
      eq(
        this.couponAdminGrantItem.couponAdminGrantJobId,
        grantJob.id,
      ),
    ]
    if (input.status !== undefined) {
      conditions.push(eq(this.couponAdminGrantItem.status, input.status))
    }
    const where = and(...conditions)
    const pageQuery = this.drizzle.buildPage({
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
    })
    const orderQuery = this.drizzle.buildOrderBy(
      input.orderBy?.trim()
        ? input.orderBy
        : { updatedAt: 'desc', id: 'asc' },
      { table: this.couponAdminGrantItem },
    )
    const [list, total] = await Promise.all([
      this.db
        .select({
          item: this.couponAdminGrantItem,
          user: {
            account: this.appUser.account,
            id: this.appUser.id,
            nickname: this.appUser.nickname,
            phoneNumber: this.appUser.phoneNumber,
          },
        })
        .from(this.couponAdminGrantItem)
        .leftJoin(
          this.appUser,
          eq(this.couponAdminGrantItem.userId, this.appUser.id),
        )
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.couponAdminGrantItem, where),
    ])
    const page = toPageResult(
      list.map((row) => {
        const label = this.buildUserLabel(row.user, row.item.userId)
        return {
          id: Number(row.item.id),
          itemId: row.item.itemId,
          title: label,
          status: row.item.status as WorkflowItemStatusEnum,
          subjectType: 'app-user',
          subjectId: row.item.userId,
          subjectLabel: label,
          successCount: row.item.createdCount,
          totalCount: row.item.grantCount,
          failureCount: row.item.failureCount,
          lastError: this.asErrorFactsOrNull(row.item.lastError),
          nextRetryAt: row.item.nextRetryAt,
          metadata: {
            account: row.user?.account ?? null,
            currentAttemptNo: row.item.currentAttemptNo,
            nickname: row.user?.nickname ?? null,
            phoneNumber: row.user?.phoneNumber ?? null,
          },
          updatedAt: row.item.updatedAt,
        }
      }),
      total,
      pageQuery,
    )
    return page
  }

  private normalizeCreateCommand(
    input: CreateCouponGrantWorkflowDto,
    operatorUserId: number,
  ) {
    const operationId = input.operationId?.trim() ?? ''
    if (!operationId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '后台批量发券操作幂等 ID 不能为空',
      )
    }
    const quantity = input.quantity ?? 1
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '每个用户发券数量必须为正整数',
      )
    }
    const userIds = this.normalizeUserIds(input.userIds)
    const couponDefinitionId = Number(input.couponDefinitionId)
    if (!Number.isInteger(couponDefinitionId) || couponDefinitionId < 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '券定义 ID 必须为正整数',
      )
    }
    const remark = input.remark?.trim() || null
    const operationHash = this.sha256Hex(operationId)
    const payloadHash = this.sha256Hex(
      JSON.stringify({
        couponDefinitionId,
        quantity,
        remark,
        userIds,
      }),
    )
    return {
      couponDefinitionId,
      identity: {
        operationHash,
        operationId,
        payloadHash,
      },
      operatorUserId,
      quantity,
      remark,
      requestedGrantCount: userIds.length * quantity,
      userIds,
    }
  }

  private async prepareCreateCommand(
    command: ReturnType<typeof this.normalizeCreateCommand>,
  ) {
    const couponDefinition = await this.readEnabledCouponDefinition(
      command.couponDefinitionId,
    )
    this.assertCouponAbility(couponDefinition)
    await this.assertUsersGrantable(command.userIds)
    return {
      ...command,
      couponDefinition,
      couponSnapshot: this.buildGrantSnapshot(couponDefinition),
    }
  }

  private normalizeUserIds(userIds: number[] | undefined) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '发券用户不能为空',
      )
    }
    const normalized = [
      ...new Set(
        userIds.map((userId) => Number(userId)).filter((userId) =>
          Number.isInteger(userId) && userId > 0
        ),
      ),
    ].sort((left, right) => left - right)
    if (normalized.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '发券用户不能为空',
      )
    }
    return normalized
  }

  private async readEnabledCouponDefinition(couponDefinitionId: number) {
    const [row] = await this.db
      .select()
      .from(this.couponDefinition)
      .where(
        and(
          eq(this.couponDefinition.id, couponDefinitionId),
          eq(this.couponDefinition.isEnabled, true),
        ),
      )
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '券定义不存在或未启用',
      )
    }
    return row
  }

  private async assertUsersGrantable(userIds: number[]) {
    const foundIds = new Set<number>()
    for (const chunk of this.chunk(userIds, USER_VALIDATE_CHUNK_SIZE)) {
      const rows = await this.db
        .select({ id: this.appUser.id })
        .from(this.appUser)
        .where(
          and(
            inArray(this.appUser.id, chunk),
            eq(this.appUser.isEnabled, true),
            eq(this.appUser.status, UserStatusEnum.NORMAL),
            isNull(this.appUser.deletedAt),
          ),
        )
      rows.forEach((row) => foundIds.add(row.id))
    }
    const invalidIds = userIds.filter((userId) => !foundIds.has(userId))
    if (invalidIds.length > 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `存在不可发券用户: ${invalidIds.slice(0, 20).join(',')}`,
      )
    }
  }

  private async readJobByOperationId(operationId: string) {
    const [row] = await this.db
      .select({
        grantJob: this.couponAdminGrantJob,
        workflowJob: this.workflowJob,
      })
      .from(this.couponAdminGrantJob)
      .innerJoin(
        this.workflowJob,
        eq(this.couponAdminGrantJob.workflowJobId, this.workflowJob.id),
      )
      .where(eq(this.couponAdminGrantJob.operationId, operationId))
      .limit(1)
    return row ?? null
  }

  private async resolveExistingJob(
    existing: {
      grantJob: CouponAdminGrantJobSelect
      workflowJob: WorkflowJobSelect
    },
    payloadHash: string,
  ) {
    if (existing.grantJob.payloadHash !== payloadHash) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '后台批量发券操作幂等 ID 已被不同请求使用',
      )
    }
    if (
      existing.workflowJob.status === WorkflowJobStatusEnum.DRAFT &&
      existing.workflowJob.expiresAt &&
      existing.workflowJob.expiresAt <= new Date()
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '后台批量发券草稿已过期，请重新提交',
      )
    }
    if (existing.workflowJob.status === WorkflowJobStatusEnum.DRAFT) {
      return this.workflowService.confirmDraft({
        jobId: existing.workflowJob.jobId,
      })
    }
    return toWorkflowJobDto(existing.workflowJob)
  }

  private async createDomainJobWithItems(
    tx: Db,
    workflowJob: WorkflowJobSelect,
    command: Awaited<ReturnType<typeof this.prepareCreateCommand>>,
  ) {
    const now = new Date()
    const [grantJob] = await tx
      .insert(this.couponAdminGrantJob)
      .values({
        workflowJobId: workflowJob.id,
        couponDefinitionId: command.couponDefinition.id,
        operationId: command.identity.operationId,
        operationHash: command.identity.operationHash,
        payloadHash: command.identity.payloadHash,
        operatorUserId: command.operatorUserId,
        perUserQuantity: command.quantity,
        selectedUserCount: command.userIds.length,
        requestedGrantCount: command.requestedGrantCount,
        remark: command.remark,
        couponSnapshot: command.couponSnapshot,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    for (const chunk of this.chunk(command.userIds, ITEM_INSERT_CHUNK_SIZE)) {
      await tx.insert(this.couponAdminGrantItem).values(
        chunk.map((userId) => ({
          itemId: randomUUID(),
          couponAdminGrantJobId: grantJob.id,
          userId,
          status: CouponAdminGrantItemStatusEnum.PENDING,
          grantCount: command.quantity,
          createdCount: 0,
          currentAttemptNo: null,
          failureCount: 0,
          lastError: null,
          lastFailedAt: null,
          nextRetryAt: null,
          createdAt: now,
          updatedAt: now,
        })),
      )
    }
  }

  private buildOperationConflictKey(operationHash: string) {
    return `coupon-admin-grant:operation:${operationHash}`
  }

  private sha256Hex(value: string) {
    return createHash('sha256').update(value).digest('hex')
  }

  private buildGrantSnapshot(definition: CouponDefinitionSelect): CouponGrantSnapshot {
    return {
      name: definition.name,
      couponType: definition.couponType as CouponTypeEnum,
      targetScope: definition.targetScope as CouponTargetScopeEnum,
      usageLimit: definition.usageLimit,
      discountRateBps: definition.discountRateBps,
      discountAmount: definition.discountAmount,
      benefitDays: definition.benefitDays,
      benefitCount: definition.benefitCount,
      validDays: definition.validDays,
      issuedAt: new Date().toISOString(),
    }
  }

  private assertCouponAbility(definition: CouponDefinitionSelect) {
    if (
      definition.couponType === CouponTypeEnum.READING &&
      (definition.targetScope !== CouponTargetScopeEnum.CHAPTER ||
        definition.usageLimit < 1)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '阅读券必须配置章节适用范围和可用次数',
      )
    }

    if (
      definition.couponType === CouponTypeEnum.DISCOUNT &&
      (definition.targetScope !== CouponTargetScopeEnum.CHAPTER ||
        (definition.discountAmount <= 0 &&
          definition.discountRateBps >= 10000))
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '折扣券必须配置章节适用范围和折扣能力',
      )
    }

    if (
      definition.couponType === CouponTypeEnum.VIP_TRIAL &&
      (definition.targetScope !== CouponTargetScopeEnum.VIP ||
        definition.benefitDays < 1)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'VIP 试用卡必须配置试用天数',
      )
    }

    if (
      definition.couponType === CouponTypeEnum.CHECK_IN_MAKEUP &&
      (definition.targetScope !== CouponTargetScopeEnum.CHECK_IN ||
        definition.benefitCount < 1)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '补签卡必须配置补签次数',
      )
    }
  }

  private buildUserLabel(
    user: Pick<AppUserSelect, 'account' | 'nickname' | 'phoneNumber'> | null,
    userId: number,
  ) {
    return user?.nickname?.trim() || user?.account?.trim() || `用户 #${userId}`
  }

  private asObjectOrNull(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  }

  private asErrorFactsOrNull(value: unknown): CouponAdminGrantErrorFacts | null {
    const object = this.asObjectOrNull(value)
    if (!object || typeof object.code !== 'string') {
      return null
    }
    return {
      code: object.code,
      context: this.asObjectOrNull(object.context) ?? {},
      domain: typeof object.domain === 'string' ? object.domain : 'coupon',
      retryable:
        typeof object.retryable === 'boolean' ? object.retryable : true,
      severity:
        typeof object.severity === 'string' ? object.severity : 'error',
      stage: typeof object.stage === 'string' ? object.stage : 'grant-user',
    }
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = []
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size))
    }
    return chunks
  }
}
