import { DrizzleService } from '@db/core'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { eq } from 'drizzle-orm'
import {
  AgreementIdInput,
  AgreementPageQuery,
  CreateAgreementInput,
  PublishedAgreementQuery,
  UpdateAgreementPublishStatusInput,
  UpdateAgreementInput,
} from './agreement.type'

/**
 * 协议服务
 *
 * 负责协议的创建、查询、更新与删除
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
   * 创建协议
   *
   * @param dto 创建协议的数据传输对象
   * @returns 是否成功
   * @throws BadRequestException 当协议标题和版本已存在时
   */
  async create(dto: CreateAgreementInput) {
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
   * 更新协议
   *
   * @param dto 更新协议的数据传输对象
   * @returns 是否成功
   * @throws NotFoundException 当协议不存在时
   * @throws BadRequestException 当标题和版本冲突时
   */
  async update(dto: UpdateAgreementInput) {
    const { id, ...updateData } = dto
    const data: Record<string, unknown> = { ...updateData }

    // 发布时设置发布时间
    if (dto.isPublished === true) {
      data.publishedAt = new Date()
    }

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.agreement)
          .set(data)
          .where(eq(this.agreement.id, id)),
      { duplicate: '协议标题和版本已存在' },
    )

    this.drizzle.assertAffectedRows(result, '协议不存在')
    return true
  }

  /**
   * 更新协议发布状态
   *
   * @param dto 更新发布状态的数据传输对象
   * @returns 是否成功
   * @throws NotFoundException 当协议不存在时
   */
  async updatePublishStatus(dto: UpdateAgreementPublishStatusInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.agreement)
        .set({ isPublished: dto.isPublished })
        .where(eq(this.agreement.id, dto.id)),
    )

    this.drizzle.assertAffectedRows(result, '协议不存在')
    return true
  }

  /**
   * 删除协议
   *
   * @param dto 删除参数
   * @returns 是否成功
   * @throws NotFoundException 当协议不存在时
   */
  async delete(dto: AgreementIdInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db.delete(this.agreement).where(eq(this.agreement.id, dto.id)),
    )

    this.drizzle.assertAffectedRows(result, '协议不存在')
    return true
  }

  /**
   * 根据ID查询协议
   *
   * @param dto 查询参数
   * @returns 协议详情
   * @throws NotFoundException 当协议不存在时
   */
  async findOne(dto: AgreementIdInput) {
    const agreement = await this.db.query.appAgreement.findFirst({
      where: { id: dto.id },
    })

    if (!agreement) {
      throw new NotFoundException('协议不存在')
    }
    return agreement
  }

  /**
   * 分页查询协议列表
   *
   * @param query 查询条件
   * @returns 分页结果
   */
  async findPage(query: AgreementPageQuery) {
    const conditions = this.drizzle.buildWhere(this.agreement, {
      and: {
        title: { like: query.title },
        isPublished: query.isPublished,
        showInAuth: query.showInAuth,
      },
    })

    return this.drizzle.ext.findPagination(this.agreement, {
      where: conditions,
      omit: ['content'],
      ...query,
    })
  }

  /**
   * 查询所有最新发布的协议
   *
   * @param dto 查询条件
   * @returns 协议列表
   */
  async getAllLatest(dto: PublishedAgreementQuery) {
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
