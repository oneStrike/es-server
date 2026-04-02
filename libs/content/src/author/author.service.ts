import type { Db } from '@db/core'
import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { applyCountDelta } from '@db/extensions'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  AuthorIdInput,
  CreateAuthorInput,
  QueryAuthorInput,
  UpdateAuthorInput,
  UpdateAuthorRecommendedInput,
  UpdateAuthorStatusInput,
} from './author.type'

/**
 * 作者服务类
 * 提供作者的增删改查等核心业务逻辑
 */
@Injectable()
export class WorkAuthorService {
  /**
   * 关注作者目标类型值。
   * 与 follow 模块解耦，避免内容域反向依赖 interaction follow 常量。
   */
  private readonly authorFollowTargetType = 2

  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get workAuthor() {
    return this.drizzle.schema.workAuthor
  }

  private get userFollow() {
    return this.drizzle.schema.userFollow
  }

  private get work() {
    return this.drizzle.schema.work
  }

  private get workAuthorRelation() {
    return this.drizzle.schema.workAuthorRelation
  }

  private async processIdsInBatches(
    ids: number[],
    batchSize: number,
    handler: (batchIds: number[]) => Promise<void>,
  ) {
    for (let index = 0; index < ids.length; index += batchSize) {
      const batchIds = ids.slice(index, index + batchSize)
      await handler(batchIds)
    }
  }

  /**
   * 更新作者粉丝数
   * 用于关注模块维护作者的冗余计数字段
   */
  async updateAuthorFollowersCount(
    tx: Db | undefined,
    authorId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const where = and(
      eq(this.workAuthor.id, authorId),
      isNull(this.workAuthor.deletedAt),
    )

    const execute = async (client: Db) =>
      applyCountDelta(client, this.workAuthor, where!, 'followersCount', delta)

    await (tx
      ? execute(tx)
      : this.drizzle.withErrorHandling(async () => execute(this.db)))
  }

  /**
   * 批量更新作者作品数。
   * 供作品创建、改作者、删除等写路径统一委托，避免散落在 work service 中手写 delta。
   */
  async updateAuthorWorkCounts(
    tx: Db | undefined,
    authorIds: number[],
    delta: number,
  ) {
    if (delta === 0 || authorIds.length === 0) {
      return
    }

    const uniqueAuthorIds = [...new Set(authorIds)]
    const execute = async (client: Db) =>
      applyCountDelta(
        client,
        this.workAuthor,
        inArray(this.workAuthor.id, uniqueAuthorIds),
        'workCount',
        delta,
      )

    await (tx
      ? execute(tx)
      : this.drizzle.withErrorHandling(async () => execute(this.db)))
  }

  /**
   * 根据 follow 事实表重建作者粉丝数。
   */
  async rebuildAuthorFollowersCount(tx: Db | undefined, authorId: number) {
    const client = tx ?? this.db
    const row = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(this.userFollow)
      .where(
        and(
          eq(this.userFollow.targetType, this.authorFollowTargetType),
          eq(this.userFollow.targetId, authorId),
        ),
      )
      .then((rows) => rows[0])

    const followersCount = Number(row?.count ?? 0)
    const result = tx
      ? await tx
          .update(this.workAuthor)
          .set({ followersCount })
          .where(
            and(
              eq(this.workAuthor.id, authorId),
              isNull(this.workAuthor.deletedAt),
            ),
          )
      : await this.drizzle.withErrorHandling(() =>
          this.db
            .update(this.workAuthor)
            .set({ followersCount })
            .where(
              and(
                eq(this.workAuthor.id, authorId),
                isNull(this.workAuthor.deletedAt),
              ),
            ),
        )
    this.drizzle.assertAffectedRows(result, '作者不存在')

    return {
      authorId,
      followersCount,
    }
  }

  /**
   * 根据作者-作品关系事实表重建作者作品数。
   * 口径定义为“作者关联的未删除作品数量”。
   */
  async rebuildAuthorWorkCount(tx: Db | undefined, authorId: number) {
    const client = tx ?? this.db
    const row = await client
      .select({ count: sql<number>`count(*)::int` })
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
          .where(
            and(
              eq(this.workAuthor.id, authorId),
              isNull(this.workAuthor.deletedAt),
            ),
          )
      : await this.drizzle.withErrorHandling(() =>
          this.db
            .update(this.workAuthor)
            .set({ workCount })
            .where(
              and(
                eq(this.workAuthor.id, authorId),
                isNull(this.workAuthor.deletedAt),
              ),
            ),
        )
    this.drizzle.assertAffectedRows(result, '作者不存在')

    return {
      authorId,
      workCount,
    }
  }

  /**
   * 在非事务上下文中重建作者粉丝数。
   * 用于管理端修复入口与离线运维场景。
   */
  async rebuildAuthorFollowersCountById(authorId: number) {
    const result = await this.rebuildAuthorFollowersCount(undefined, authorId)
    return {
      id: result.authorId,
      followersCount: result.followersCount,
    }
  }

  /**
   * 全量重建作者粉丝数。
   * 当前用于管理端运维入口，按批次串行推进以避免单次压力过大。
   */
  async rebuildAllAuthorFollowersCount(batchSize = 200) {
    const authorIds = await this.db
      .select({ id: this.workAuthor.id })
      .from(this.workAuthor)
      .where(isNull(this.workAuthor.deletedAt))
      .orderBy(this.workAuthor.id)
      .then((rows) => rows.map((row) => row.id))

    await this.processIdsInBatches(authorIds, batchSize, async (ids) => {
      await Promise.all(
        ids.map(async (authorId) =>
          this.rebuildAuthorFollowersCount(undefined, authorId),
        ),
      )
    })

    return true
  }

  /**
   * 在非事务上下文中重建作者作品数。
   * 用于管理端修复入口与离线运维场景。
   */
  async rebuildAuthorWorkCountById(authorId: number) {
    const result = await this.rebuildAuthorWorkCount(undefined, authorId)
    return {
      id: result.authorId,
      workCount: result.workCount,
    }
  }

  /**
   * 全量重建作者作品数。
   */
  async rebuildAllAuthorWorkCount(batchSize = 200) {
    const authorIds = await this.db
      .select({ id: this.workAuthor.id })
      .from(this.workAuthor)
      .where(isNull(this.workAuthor.deletedAt))
      .orderBy(this.workAuthor.id)
      .then((rows) => rows.map((row) => row.id))

    await this.processIdsInBatches(authorIds, batchSize, async (ids) => {
      await Promise.all(
        ids.map(async (authorId) =>
          this.rebuildAuthorWorkCount(undefined, authorId),
        ),
      )
    })

    return true
  }

  /**
   * 创建作者
   * @param createAuthorInput 创建作者的数据
   * @returns 创建的作者信息
   */
  async createAuthor(createAuthorInput: CreateAuthorInput) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.workAuthor).values(createAuthorInput),
    )
    return true
  }

  /**
   * 分页查询作者列表
   * @param queryAuthorDto 查询条件
   * @returns 分页作者列表
   */
  async getAuthorPage(queryAuthorDto: QueryAuthorInput) {
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
    if (nationality !== undefined) {
      conditions.push(eq(this.workAuthor.nationality, nationality))
    }
    if (gender !== undefined) {
      conditions.push(eq(this.workAuthor.gender, gender))
    }
    if (isRecommended !== undefined) {
      conditions.push(eq(this.workAuthor.isRecommended, isRecommended))
    }
    if (name) {
      conditions.push(
        buildILikeCondition(this.workAuthor.name, name)!,
      )
    }

    let where: SQL | undefined = and(...conditions)
    if (type && type !== '[]') {
      const values = JSON.parse(type) as number[]
      if (values.length > 0) {
        const typeArray = sql`ARRAY[${sql.join(
          values.map((v) => sql`${v}`),
          sql`, `,
        )}]::smallint[]`
        where = and(where, sql`${this.workAuthor.type} @> ${typeArray}`)
      }
    }

    return this.drizzle.ext.findPagination(this.workAuthor, {
      where,
      ...pageDto,
      omit: ['remark', 'description', 'deletedAt'],
    })
  }

  /**
   * 获取作者详情
   * @param input 作者ID
   * @returns 作者详情信息
   */
  async getAuthorDetail(input: AuthorIdInput) {
    const author = await this.db.query.workAuthor.findFirst({
      where: { id: input.id, deletedAt: { isNull: true } },
    })

    if (!author) {
      throw new BadRequestException('作者不存在')
    }

    return author
  }

  /**
   * 更新作者信息
   * @param updateAuthorDto 更新作者的数据
   * @returns 更新后的作者信息
   */
  async updateAuthor(updateAuthorDto: UpdateAuthorInput) {
    const { id, ...updateData } = updateAuthorDto

    // 更新作者信息
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workAuthor)
        .set(updateData)
        .where(
          and(eq(this.workAuthor.id, id), isNull(this.workAuthor.deletedAt)),
        ),
    )
    this.drizzle.assertAffectedRows(result, '作者不存在')
    return true
  }

  async updateAuthorStatus(input: UpdateAuthorStatusInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workAuthor)
        .set({ isEnabled: input.isEnabled })
        .where(
          and(
            eq(this.workAuthor.id, input.id),
            isNull(this.workAuthor.deletedAt),
          ),
        ),
    )
    this.drizzle.assertAffectedRows(result, '作者不存在')
    return true
  }

  async updateAuthorRecommended(input: UpdateAuthorRecommendedInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workAuthor)
        .set({ isRecommended: input.isRecommended })
        .where(
          and(
            eq(this.workAuthor.id, input.id),
            isNull(this.workAuthor.deletedAt),
          ),
        ),
    )
    this.drizzle.assertAffectedRows(result, '作者不存在')
    return true
  }

  /**
   * 软删除作者
   * @param input 作者ID
   * @returns 删除结果
   */
  async deleteAuthor(input: AuthorIdInput) {
    // 验证作者是否存在
    const existingAuthor = await this.db.query.workAuthor.findFirst({
      where: { id: input.id, deletedAt: { isNull: true } },
    })
    if (!existingAuthor) {
      throw new BadRequestException('作者不存在')
    }
    const linkedWorkRow = await this.db
      .select({ count: sql<number>`count(*)::int` })
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
      throw new BadRequestException(
        `该作者还有 ${linkedWorkCount} 个关联作品，无法删除`,
      )
    }

    const deleted = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workAuthor)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(this.workAuthor.id, input.id),
            isNull(this.workAuthor.deletedAt),
          ),
        ),
    )
    this.drizzle.assertAffectedRows(deleted, '作者不存在')
    return true
  }
}
