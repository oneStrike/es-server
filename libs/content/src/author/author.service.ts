import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
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
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get workAuthor() {
    return this.drizzle.schema.workAuthor
  }

  /**
   * 创建作者
   * @param createAuthorInput 创建作者的数据
   * @returns 创建的作者信息
   */
  async createAuthor(createAuthorInput: CreateAuthorInput) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.workAuthor)
        .values(createAuthorInput),
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

    const baseWhere = this.drizzle.buildWhere(this.workAuthor, {
      and: {
        deletedAt: { isNull: true },
        isEnabled,
        nationality,
        gender,
        isRecommended,
        name: name ? { like: name } : undefined,
      },
    })

    let where = baseWhere
    if (type && type !== '[]') {
      const values = JSON.parse(type) as number[]
      if (values.length > 0) {
        const typeArray = sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::smallint[]`
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

    // 验证作者是否存在
    const existingAuthor = await this.db.query.workAuthor.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })
    if (!existingAuthor) {
      throw new BadRequestException('作者不存在')
    }

    // 更新作者信息
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workAuthor)
        .set(updateData)
        .where(and(eq(this.workAuthor.id, id), isNull(this.workAuthor.deletedAt))),
    )
    this.drizzle.assertAffectedRows(result, '作者不存在')
    return true
  }

  async updateAuthorStatus(input: UpdateAuthorStatusInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workAuthor)
        .set({ isEnabled: input.isEnabled })
        .where(and(eq(this.workAuthor.id, input.id), isNull(this.workAuthor.deletedAt))),
    )
    this.drizzle.assertAffectedRows(result, '作者不存在')
    return true
  }

  async updateAuthorRecommended(input: UpdateAuthorRecommendedInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workAuthor)
        .set({ isRecommended: input.isRecommended })
        .where(and(eq(this.workAuthor.id, input.id), isNull(this.workAuthor.deletedAt))),
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
    if (existingAuthor.workCount && existingAuthor.workCount > 0) {
      throw new BadRequestException(
        `该作者还有 ${existingAuthor.workCount} 个关联作品，无法删除`,
      )
    }

    const deleted = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workAuthor)
        .set({ deletedAt: new Date() })
        .where(and(eq(this.workAuthor.id, input.id), isNull(this.workAuthor.deletedAt))),
    )
    this.drizzle.assertAffectedRows(deleted, '作者不存在')
    return true
  }
}
