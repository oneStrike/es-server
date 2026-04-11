import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto/base.dto'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
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
   * 读取协议最小生命周期状态。
   * 统一给更新、下线等入口复用，避免各处分散判断“是否已发布”。
   */
  private async findAgreementLifecycle(id: number) {
    const agreement = await this.db.query.appAgreement.findFirst({
      where: { id },
      columns: {
        id: true,
        isPublished: true,
      },
    })

    if (!agreement) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '协议不存在',
      )
    }

    return agreement
  }

  /**
   * 从公开协议列表中按标题收敛到最新发布版本。
   * 当同一标题存在多个历史发布版本时，只保留发布时间最新的一条。
   */
  private pickLatestPublishedAgreements<
    T extends {
      id: number
      title: string
      publishedAt?: Date | null
    },
  >(agreements: T[]
) {
    const seenTitles = new Set<string>()

    return [...agreements]
      .sort((left, right) => {
        const publishedAtDiff =
          (right.publishedAt?.getTime() ?? 0) -
          (left.publishedAt?.getTime() ?? 0)

        if (publishedAtDiff !== 0) {
          return publishedAtDiff
        }

        return right.id - left.id
      })
      .filter((agreement) => {
        if (seenTitles.has(agreement.title)) {
          return false
        }

        seenTitles.add(agreement.title)
        return true
      })
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
    const agreement = await this.findAgreementLifecycle(id)
    if (agreement.isPublished) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '已发布协议不允许直接修改，请新建版本后发布',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.agreement)
          .set(updateData)
          .where(eq(this.agreement.id, id)),
      {
        duplicate: '协议标题和版本已存在',
        notFound: '协议不存在',
      },
    )
    return true
  }

  /**
   * 切换协议发布状态。
   * 发布时补写 `publishedAt`，下线统一通过 `update-status(false)` 完成。
   */
  async updatePublishStatus(dto: UpdatePublishedStatusDto) {
    const agreement = await this.findAgreementLifecycle(dto.id)
    if (!dto.isPublished && !agreement.isPublished) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '未发布协议不允许下线',
      )
    }

    const updateData = dto.isPublished
      ? { isPublished: true, publishedAt: new Date() }
      : { isPublished: false }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.agreement)
          .set(updateData)
          .where(eq(this.agreement.id, dto.id)),
      { notFound: '协议不存在' },
    )
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '协议不存在',
      )
    }
    return agreement
  }

  /**
   * 组合标题与发布状态筛选条件，并在分页结果中省略正文内容。
   */
  async findPage(query: QueryAgreementDto) {
    const conditions: SQL[] = []

    if (query.title) {
      conditions.push(buildILikeCondition(this.agreement.title, query.title)!)
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
   * 该接口按标题收敛为最新发布版本，并省略正文，供登录注册等轻量场景使用。
   */
  async getAllLatest(dto: QueryPublishedAgreementDto) {
    const agreements = await this.db.query.appAgreement.findMany({
      where: {
        isPublished: true,
        showInAuth: dto.showInAuth,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      columns: { content: false },
    })

    return this.pickLatestPublishedAgreements(agreements)
  }
}
