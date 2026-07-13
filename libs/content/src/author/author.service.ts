import type { Db, DbExecutor, DbTransaction } from '@db/core'
import type { SQL } from 'drizzle-orm'
import {
  acquireIntegrityLocks,
  buildILikeCondition,
  DrizzleService,
  toPageResult,
} from '@db/core'

import {
  BusinessErrorCode,
  FollowTargetTypeContractEnum,
  WorkTypeEnum,
} from '@libs/platform/constant'
import { IdDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'
import { workCatalogAuthorLock } from '../work/core/work-integrity-lock'
import { AuthorTypeEnum } from './author.constant'
import {
  AuthorFollowCountRepairResultDto,
  AuthorWorkCountRepairResultDto,
  CreateAuthorDto,
  QueryAuthorDto,
  UpdateAuthorDto,
  UpdateAuthorRecommendedDto,
  UpdateAuthorStatusDto,
} from './dto/author.dto'

/**
 * 作者服务类
 * 负责作者资料维护，以及粉丝数、作品数等冗余计数修复能力
 */
@Injectable()
export class WorkAuthorService {
  // 初始化 WorkAuthorService 依赖。
  constructor(private readonly drizzle: DrizzleService) {}

  // 数据库连接实例。
  private get db() {
    return this.drizzle.db
  }

  // 作者表。
  get workAuthor() {
    return this.drizzle.schema.workAuthor
  }

  // 关注关系表。
  private get userFollow() {
    return this.drizzle.schema.userFollow
  }

  // 作品表。
  private get work() {
    return this.drizzle.schema.work
  }

  // 作者-作品关联表。
  private get workAuthorRelation() {
    return this.drizzle.schema.workAuthorRelation
  }

  private async assertAuthorTypeUpdateAllowed(
    authorId: number,
    nextTypes: AuthorTypeEnum[] | null | undefined,
    runner: DbTransaction,
  ) {
    if (nextTypes === undefined) {
      return
    }

    const normalizedTypes = nextTypes ?? []
    const mismatchConditions: SQL[] = []
    if (!normalizedTypes.includes(AuthorTypeEnum.MANGA)) {
      mismatchConditions.push(eq(this.work.type, WorkTypeEnum.COMIC))
    }
    if (!normalizedTypes.includes(AuthorTypeEnum.NOVEL)) {
      mismatchConditions.push(eq(this.work.type, WorkTypeEnum.NOVEL))
    }
    if (mismatchConditions.length === 0) {
      return
    }

    const [linkedWork] = await runner
      .select({
        id: this.work.id,
        type: this.work.type,
      })
      .from(this.workAuthorRelation)
      .innerJoin(
        this.work,
        and(
          eq(this.work.id, this.workAuthorRelation.workId),
          isNull(this.work.deletedAt),
        ),
      )
      .where(
        and(
          eq(this.workAuthorRelation.authorId, authorId),
          or(...mismatchConditions),
        ),
      )
      .limit(1)

    if (!linkedWork) {
      return
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      linkedWork.type === WorkTypeEnum.COMIC
        ? '该作者仍有关联漫画作品，不能移除漫画家角色'
        : '该作者仍有关联小说作品，不能移除轻小说作者角色',
    )
  }

  // 构建未软删除作者的查询条件，统一约束作者写入和计数修复入口。
  private activeAuthorWhere(authorId: number): SQL {
    return and(
      eq(this.workAuthor.id, authorId),
      isNull(this.workAuthor.deletedAt),
    )!
  }

  // 按增量更新作者粉丝数，该方法供关注域写路径调用；若未传事务，则在独立错误处理上下文中执行。
  async updateAuthorFollowersCount(
    tx: DbExecutor | undefined,
    authorId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const where = this.activeAuthorWhere(authorId)

    const execute = async (client: Db) =>
      this.applyAuthorFollowersCountDelta(client, where, delta)

    await (tx
      ? execute(tx)
      : this.drizzle.withErrorHandling(async () => execute(this.db)))
  }

  // 批量更新作者作品数，供作品创建、改作者、删除等写路径统一委托，避免散落在 work service 中手写 delta。
  async updateAuthorWorkCounts(
    tx: DbExecutor | undefined,
    authorIds: number[],
    delta: number,
  ) {
    if (delta === 0 || authorIds.length === 0) {
      return
    }

    const uniqueAuthorIds = [...new Set(authorIds)]
    const execute = async (client: Db) =>
      this.applyAuthorWorkCountDelta(
        client,
        inArray(this.workAuthor.id, uniqueAuthorIds),
        delta,
      )

    await (tx
      ? execute(tx)
      : this.drizzle.withErrorHandling(async () => execute(this.db)))
  }

  // 原子更新作者粉丝数，并禁止负数增量把计数扣到 0 以下。
  private async applyAuthorFollowersCountDelta(
    client: Db,
    where: SQL,
    delta: number,
  ) {
    const amount = Math.abs(delta)
    const updateWhere =
      delta > 0
        ? where
        : and(where, gte(this.workAuthor.followersCount, amount))!
    const updated = await client
      .update(this.workAuthor)
      .set({
        followersCount:
          delta > 0
            ? sql`${this.workAuthor.followersCount} + ${amount}`
            : sql`${this.workAuthor.followersCount} - ${amount}`,
      })
      .where(updateWhere)
      .returning({ id: this.workAuthor.id })
    await this.assertCountDeltaUpdated(client, where, updated.length)
  }

  // 原子更新作者作品数，并禁止负数增量把计数扣到 0 以下。
  private async applyAuthorWorkCountDelta(
    client: Db,
    where: SQL,
    delta: number,
  ) {
    const amount = Math.abs(delta)
    const updateWhere =
      delta > 0 ? where : and(where, gte(this.workAuthor.workCount, amount))!
    const updated = await client
      .update(this.workAuthor)
      .set({
        workCount:
          delta > 0
            ? sql`${this.workAuthor.workCount} + ${amount}`
            : sql`${this.workAuthor.workCount} - ${amount}`,
      })
      .where(updateWhere)
      .returning({ id: this.workAuthor.id })
    await this.assertCountDeltaUpdated(client, where, updated.length)
  }

  // 保持旧计数增量语义：未命中目标和扣减不足都以 RESOURCE_NOT_FOUND 暴露给调用方。
  private async assertCountDeltaUpdated(
    client: Db,
    where: SQL,
    updatedCount: number,
  ) {
    if (updatedCount > 0) {
      return
    }
    const [existing] = await client
      .select({ id: this.workAuthor.id })
      .from(this.workAuthor)
      .where(where)
      .limit(1)
    throw new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      existing ? '目标不存在或计数不足' : '目标不存在',
    )
  }

  // 根据 follow 事实表重建作者粉丝数，重建时只统计当前存在的关注关系，并要求作者记录未被软删除。
  async rebuildAuthorFollowersCount(
    tx: DbExecutor | undefined,
    authorId: number,
  ) {
    const client = tx ?? this.db
    const row = await client
      .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
      .from(this.userFollow)
      .where(
        and(
          eq(this.userFollow.targetType, FollowTargetTypeContractEnum.AUTHOR),
          eq(this.userFollow.targetId, authorId),
        ),
      )
      .then((rows) => rows[0])

    const followersCount = Number(row?.count ?? 0)
    const result = tx
      ? await tx
          .update(this.workAuthor)
          .set({ followersCount })
          .where(this.activeAuthorWhere(authorId))
      : await this.drizzle.withErrorHandling(() =>
          this.db
            .update(this.workAuthor)
            .set({ followersCount })
            .where(this.activeAuthorWhere(authorId)),
        )
    this.drizzle.assertAffectedRows(result, '作者不存在')

    return {
      authorId,
      followersCount,
    }
  }

  // 根据作者-作品关系事实表重建作者作品数，口径定义为“作者关联的未删除作品数量”。
  async rebuildAuthorWorkCount(tx: DbExecutor | undefined, authorId: number) {
    const client = tx ?? this.db
    const row = await client
      .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
      .from(this.workAuthorRelation)
      .innerJoin(
        this.work,
        and(
          eq(this.work.id, this.workAuthorRelation.workId),
          isNull(this.work.deletedAt),
        ),
      )
      .where(eq(this.workAuthorRelation.authorId, authorId))
      .then((rows) => rows[0])

    const workCount = Number(row?.count ?? 0)
    const result = tx
      ? await tx
          .update(this.workAuthor)
          .set({ workCount })
          .where(this.activeAuthorWhere(authorId))
      : await this.drizzle.withErrorHandling(() =>
          this.db
            .update(this.workAuthor)
            .set({ workCount })
            .where(this.activeAuthorWhere(authorId)),
        )
    this.drizzle.assertAffectedRows(result, '作者不存在')

    return {
      authorId,
      workCount,
    }
  }

  // 在非事务上下文中重建作者粉丝数，用于管理端修复入口与离线运维场景。
  async rebuildAuthorFollowersCountById(
    input: IdDto,
  ): Promise<AuthorFollowCountRepairResultDto> {
    const result = await this.rebuildAuthorFollowersCount(undefined, input.id)
    return {
      id: result.authorId,
      followersCount: result.followersCount,
    }
  }

  // 全量重建作者粉丝数：基于 follow 事实表一次性聚合更新所有未软删除作者。
  async rebuildAllAuthorFollowersCount(batchSize = 200) {
    void batchSize

    await this.drizzle.withErrorHandling(() =>
      this.db.execute(sql`
        update ${this.workAuthor} as author
        set
          followers_count = coalesce(fact.followers_count, 0),
          updated_at = now()
        from (
          select
            live_author.id as author_id,
            count(follow.target_id)::int as followers_count
          from ${this.workAuthor} as live_author
          left join ${this.userFollow} as follow
            on follow.target_type = ${FollowTargetTypeContractEnum.AUTHOR}
           and follow.target_id = live_author.id
          where live_author.deleted_at is null
          group by live_author.id
        ) as fact
        where author.id = fact.author_id
          and author.deleted_at is null
      `),
    )

    return true
  }

  // 在非事务上下文中重建作者作品数，用于管理端修复入口与离线运维场景。
  async rebuildAuthorWorkCountById(
    input: IdDto,
  ): Promise<AuthorWorkCountRepairResultDto> {
    const result = await this.rebuildAuthorWorkCount(undefined, input.id)
    return {
      id: result.authorId,
      workCount: result.workCount,
    }
  }

  // 全量重建作者作品数：基于作者作品关系和未删除作品事实一次性聚合更新。
  async rebuildAllAuthorWorkCount(batchSize = 200) {
    void batchSize

    await this.drizzle.withErrorHandling(() =>
      this.db.execute(sql`
        update ${this.workAuthor} as author
        set
          work_count = coalesce(fact.work_count, 0),
          updated_at = now()
        from (
          select
            live_author.id as author_id,
            count(work_fact.id)::int as work_count
          from ${this.workAuthor} as live_author
          left join ${this.workAuthorRelation} as relation
            on relation.author_id = live_author.id
          left join ${this.work} as work_fact
            on work_fact.id = relation.work_id
           and work_fact.deleted_at is null
          where live_author.deleted_at is null
          group by live_author.id
        ) as fact
        where author.id = fact.author_id
          and author.deleted_at is null
      `),
    )

    return true
  }

  // 创建作者，默认值交给数据库字段默认语义处理，唯一约束和其他写入异常统一走 `withErrorHandling`。
  async createAuthor(createAuthorInput: CreateAuthorDto) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.workAuthor).values(createAuthorInput),
    )
    return true
  }

  // 分页查询作者列表，`type` 以 JSON 字符串形式传入，兼容 query 参数的序列化方式；分页结果默认隐藏后台备注和长描述。
  async getAuthorPage(queryAuthorDto: QueryAuthorDto) {
    const {
      name,
      isEnabled,
      nationality,
      gender,
      isRecommended,
      type,
      ...pageDto
    } = queryAuthorDto

    const conditions: SQL[] = [isNull(this.workAuthor.deletedAt)]

    if (isEnabled !== undefined) {
      conditions.push(eq(this.workAuthor.isEnabled, isEnabled))
    }
    if (nationality != null) {
      conditions.push(eq(this.workAuthor.nationality, nationality))
    }
    if (gender !== undefined) {
      conditions.push(eq(this.workAuthor.gender, gender))
    }
    if (isRecommended !== undefined) {
      conditions.push(eq(this.workAuthor.isRecommended, isRecommended))
    }
    if (name) {
      conditions.push(buildILikeCondition(this.workAuthor.name, name)!)
    }

    let where: SQL | undefined = and(...conditions)
    const values = this.parseAuthorTypeFilter(type)
    if (values.length > 0) {
      const typeArray = sql`ARRAY[${sql.join(
        values.map((v) => sql`${v}`),
        sql`, `,
      )}]::smallint[]`
      where = and(where, sql`${this.workAuthor.type} @> ${typeArray}`)
    }

    const page = this.drizzle.buildPage(pageDto)
    const orderQuery = this.drizzle.buildOrderBy(pageDto.orderBy, {
      table: this.workAuthor,
    })
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.workAuthor.id,
          name: this.workAuthor.name,
          avatar: this.workAuthor.avatar,
          nationality: this.workAuthor.nationality,
          gender: this.workAuthor.gender,
          type: this.workAuthor.type,
          isEnabled: this.workAuthor.isEnabled,
          isRecommended: this.workAuthor.isRecommended,
          workCount: this.workAuthor.workCount,
          followersCount: this.workAuthor.followersCount,
          createdAt: this.workAuthor.createdAt,
          updatedAt: this.workAuthor.updatedAt,
        })
        .from(this.workAuthor)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.workAuthor, where),
    ])

    return toPageResult(
      list.map((item) => ({
        ...item,
        avatar: item.avatar ?? null,
        nationality: item.nationality ?? null,
        type: item.type ?? null,
      })),
      total,
      page,
    )
  }

  // 获取作者详情，仅返回未软删除的作者记录，未命中时按业务异常处理。
  async getAuthorDetail(input: IdDto) {
    const author = await this.db.query.workAuthor.findFirst({
      where: { id: input.id, deletedAt: { isNull: true } },
      columns: {
        id: true,
        name: true,
        avatar: true,
        description: true,
        isEnabled: true,
        type: true,
        nationality: true,
        gender: true,
        remark: true,
        workCount: true,
        followersCount: true,
        isRecommended: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!author) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '作者不存在',
      )
    }

    return {
      id: author.id,
      name: author.name,
      avatar: author.avatar ?? null,
      description: author.description ?? null,
      isEnabled: author.isEnabled,
      type: author.type ?? null,
      nationality: author.nationality ?? null,
      gender: author.gender,
      remark: author.remark ?? null,
      workCount: author.workCount,
      followersCount: author.followersCount,
      isRecommended: author.isRecommended,
      createdAt: author.createdAt,
      updatedAt: author.updatedAt,
    }
  }

  private parseAuthorTypeFilter(type?: string): AuthorTypeEnum[] {
    if (!type || type === '[]') {
      return []
    }

    let values: unknown
    try {
      values = JSON.parse(type)
    } catch {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '作者类型筛选参数必须是 JSON 数组',
      )
    }

    if (!Array.isArray(values)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '作者类型筛选参数必须是 JSON 数组',
      )
    }

    const allowedTypes = new Set<number>([
      AuthorTypeEnum.MANGA,
      AuthorTypeEnum.NOVEL,
    ])
    const normalizedValues = values.map((value) => Number(value))
    if (
      normalizedValues.some(
        (value) => !Number.isInteger(value) || !allowedTypes.has(value),
      )
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '作者类型筛选参数包含不支持的类型',
      )
    }

    return [...new Set(normalizedValues)] as AuthorTypeEnum[]
  }

  // 更新作者基础资料，该入口不处理粉丝数、作品数等冗余字段重建，只负责编辑侧可写字段。
  async updateAuthor(updateAuthorDto: UpdateAuthorDto) {
    const { id, ...updateData } = updateAuthorDto

    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [workCatalogAuthorLock(id)])
        const existingAuthor = await tx.query.workAuthor.findFirst({
          where: { id, deletedAt: { isNull: true } },
          columns: { id: true },
        })
        if (!existingAuthor) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '作者不存在',
          )
        }
        await this.assertAuthorTypeUpdateAllowed(id, updateData.type, tx)
        const result = await tx
          .update(this.workAuthor)
          .set(updateData)
          .where(this.activeAuthorWhere(id))
        this.drizzle.assertAffectedRows(result, '作者不存在')
      },
    })
    return true
  }

  // 切换作者启用状态。
  async updateAuthorStatus(input: UpdateAuthorStatusDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [workCatalogAuthorLock(input.id)])
        const existingAuthor = await tx.query.workAuthor.findFirst({
          where: { id: input.id, deletedAt: { isNull: true } },
          columns: { id: true },
        })
        if (!existingAuthor) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '作者不存在',
          )
        }
        const result = await tx
          .update(this.workAuthor)
          .set({ isEnabled: input.isEnabled })
          .where(this.activeAuthorWhere(input.id))
        this.drizzle.assertAffectedRows(result, '作者不存在')
      },
    })
    return true
  }

  // 切换作者推荐状态，推荐位只影响前台展示，不改变启用状态和其他资料字段。
  async updateAuthorRecommended(input: UpdateAuthorRecommendedDto) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workAuthor)
          .set({ isRecommended: input.isRecommended })
          .where(this.activeAuthorWhere(input.id)),
      { notFound: '作者不存在' },
    )
    return true
  }

  // 软删除作者，删除前会校验作者存在且没有任何未删除作品关联，避免内容域出现悬空作者引用。
  async deleteAuthor(input: IdDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [workCatalogAuthorLock(input.id)])
        const existingAuthor = await tx.query.workAuthor.findFirst({
          where: { id: input.id, deletedAt: { isNull: true } },
          columns: { id: true },
        })
        if (!existingAuthor) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '作者不存在',
          )
        }
        const linkedWorkRow = await tx
          .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
          .from(this.workAuthorRelation)
          .innerJoin(
            this.work,
            and(
              eq(this.work.id, this.workAuthorRelation.workId),
              isNull(this.work.deletedAt),
            ),
          )
          .where(eq(this.workAuthorRelation.authorId, input.id))
          .then((rows) => rows[0])

        const linkedWorkCount = Number(linkedWorkRow?.count ?? 0)
        if (linkedWorkCount > 0) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            `该作者还有 ${linkedWorkCount} 个关联作品，无法删除`,
          )
        }
        const result = await tx
          .update(this.workAuthor)
          .set({ deletedAt: new Date() })
          .where(this.activeAuthorWhere(input.id))
        this.drizzle.assertAffectedRows(result, '作者不存在')
      },
    })
    return true
  }
}
