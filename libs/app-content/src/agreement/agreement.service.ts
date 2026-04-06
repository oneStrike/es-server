import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto/base.dto';
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  CreateAgreementDto,
  QueryAgreementDto,
  QueryPublishedAgreementDto,
  UpdateAgreementDto,
} from './dto/agreement.dto'

/**
 * 协议服务
 *
 * 负责协议写入、发布状态切换和对外读取
 */
@Injectable()
export class AgreementService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 协议表 */
  private get agreement() {
    return this.drizzle.schema.appAgreement
  }

  /**
   * 创建协议草稿。
   * 标题和版本命中唯一约束时，统一交给 `withErrorHandling` 转换为业务异常。
   */
  async create(dto: CreateAgreementDto) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.agreement).values({
          title: dto.title,
          content: dto.content,
          version: dto.version,
          isForce: dto.isForce ?? false,
          showInAuth: dto.showInAuth ?? false,
        }),
      { duplicate: '协议已存在' },
    )
    return true
  }

  /**
   * 更新协议主体字段，不在此入口处理发布状态切换。
   * 发布动作统一走 `updatePublishStatus`，避免同一语义分散在两个入口里。
   */
  async update(dto: UpdateAgreementDto) {
    const { id, ...updateData } = dto
    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.agreement)
          .set(updateData)
          .where(eq(this.agreement.id, id)),
      { duplicate: '协议标题和版本已存在' },
    )

    this.drizzle.assertAffectedRows(result, '协议不存在')
    return true
  }

  /**
   * 切换协议发布状态。
   * 发布时补写 `publishedAt`，取消发布时保留历史发布时间用于追溯。
   */
  async updatePublishStatus(dto: UpdatePublishedStatusDto) {
    const updateData = dto.isPublished
      ? { isPublished: true, publishedAt: new Date() }
      : { isPublished: false }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.agreement)
        .set(updateData)
        .where(eq(this.agreement.id, dto.id)),
    )

    this.drizzle.assertAffectedRows(result, '协议不存在')
    return true
  }

  /**
   * 通过 `isPublished=false` 逻辑下线协议，不执行物理删除。
   */
  async delete(dto: IdDto) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.agreement)
        .set({ isPublished: false })
        .where(eq(this.agreement.id, dto.id)),
    )

    this.drizzle.assertAffectedRows(result, '协议不存在')
    return true
  }

  /**
   * 按主键查询协议详情。
   * `publishedOnly=true` 时只允许返回已发布版本，用于 app/public 侧公开读取。
   */
  async findOne(
    dto: IdDto,
    options?: {
      publishedOnly?: boolean
    },
  ) {
    const agreement = await this.db.query.appAgreement.findFirst({
      where: {
        id: dto.id,
        isPublished: options?.publishedOnly ? true : undefined,
      },
    })

    if (!agreement) {
      throw new NotFoundException('协议不存在')
    }
    return agreement
  }

  /**
   * 组合标题与发布状态筛选条件，并在分页结果中省略正文内容。
   */
  async findPage(query: QueryAgreementDto) {
    const conditions: SQL[] = []

    if (query.title) {
      conditions.push(
        buildILikeCondition(this.agreement.title, query.title)!,
      )
    }
    if (query.isPublished !== undefined) {
      conditions.push(eq(this.agreement.isPublished, query.isPublished))
    }
    if (query.showInAuth !== undefined) {
      conditions.push(eq(this.agreement.showInAuth, query.showInAuth))
    }

    return this.drizzle.ext.findPagination(this.agreement, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      omit: ['content'],
      ...query,
    })
  }

  /**
   * 查询公开可见的最新协议列表。
   * 该接口按发布时间倒序返回，并省略正文，供登录注册等轻量场景使用。
   */
  async getAllLatest(dto: QueryPublishedAgreementDto) {
    return this.db.query.appAgreement.findMany({
      where: {
        isPublished: true,
        showInAuth: dto.showInAuth,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      columns: { content: false },
    })
  }
}
