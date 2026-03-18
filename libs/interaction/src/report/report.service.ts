import type { InteractionTx } from '../interaction-tx.type'
import type {
  CreateReportInput,
  CreateUserReportInput,
  CreateUserReportOptions,
} from './report.type'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { IReportTargetResolver } from './interfaces/report-target-resolver.interface'
import { ReportGrowthService } from './report-growth.service'
import { ReportStatusEnum, ReportTargetTypeEnum } from './report.constant'

/**
 * 举报服务
 * 提供举报创建、查询等核心业务逻辑
 * 通过解析器模式支持多种目标类型（作品、章节、评论、论坛主题、用户等）的举报操作
 */
@Injectable()
export class ReportService {
  /** 目标类型到解析器的映射表，用于根据目标类型路由到对应的解析器 */
  private readonly resolvers = new Map<
    ReportTargetTypeEnum,
    IReportTargetResolver
  >()

  constructor(
    private readonly reportGrowthService: ReportGrowthService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userReport() {
    return this.drizzle.schema.userReport
  }

  /**
   * 注册目标解析器
   * 供其他模块在应用启动时注册自己的举报解析器
   * @param resolver - 举报目标解析器实例
   */
  registerResolver(resolver: IReportTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Report resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  /**
   * 获取指定目标类型的解析器
   * @param targetType - 举报目标类型
   * @returns 对应的目标解析器
   * @throws BadRequestException 当目标类型不支持时抛出异常
   */
  private getResolver(targetType: ReportTargetTypeEnum): IReportTargetResolver {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException('不支持的举报目标类型')
    }
    return resolver
  }

  /**
   * 创建举报
   * 执行完整的举报流程：解析目标元数据、校验举报人、拦截自举报、创建举报记录、执行后置钩子、发放成长奖励
   * @param dto - 创建举报入参
   * @param options - 可选项
   * @returns 创建的举报记录
   */
  async createReport(
    dto: CreateReportInput,
    options: CreateUserReportOptions = {},
  ) {
    const {
      reporterId,
      targetType,
      targetId,
      reasonType,
      description,
      evidenceUrl,
    } = dto

    const resolver = this.getResolver(targetType)

    const report = await this.db.transaction(async (tx: InteractionTx) => {
      await this.ensureReporterExists(reporterId)
      const targetMeta = await resolver.resolveMeta(tx, targetId)

      this.ensureCanReportOwnTarget(reporterId, targetMeta.ownerUserId)

      const created = await this.createUserReport(
        tx,
        {
          reporterId,
          targetType,
          targetId,
          sceneType: targetMeta.sceneType,
          sceneId: targetMeta.sceneId,
          commentLevel: targetMeta.commentLevel,
          reasonType,
          description,
          evidenceUrl,
          status: ReportStatusEnum.PENDING,
        },
        {
          duplicateMessage:
            options.duplicateMessage ?? this.getDuplicateMessage(targetType),
        },
      )

      if (resolver.postReportHook) {
        await resolver.postReportHook(tx, targetId, reporterId, targetMeta)
      }

      return created
    })

    await this.reportGrowthService.rewardReportCreated({
      reportId: report.id,
      reporterId,
      targetType,
      targetId,
    })

    return report
  }

  /**
   * 真正执行举报落库
   * 该方法只负责写库，不再承担目标校验职责
   * @param tx - 事务客户端
   * @param dto - 创建举报记录的完整数据
   * @param options - 可选项
   * @returns 创建的举报记录
   */
  private async createUserReport(
    tx: InteractionTx,
    dto: CreateUserReportInput,
    options: CreateUserReportOptions = {},
  ) {
    const { status, ...otherDto } = dto
    const rows = await this.drizzle.withErrorHandling(
      () =>
        tx
          .insert(this.userReport)
          .values({
            ...otherDto,
            status: status ?? ReportStatusEnum.PENDING,
          })
          .returning(),
      {
        duplicate: options.duplicateMessage ?? '您已经举报过该内容，请勿重复举报',
      },
    )
    return rows[0]
  }

  /**
   * 校验举报人是否存在
   * @param reporterId - 举报人ID
   * @throws BadRequestException 当举报人不存在时抛出异常
   */
  private async ensureReporterExists(reporterId: number) {
    const existed = await this.drizzle.ext.existsActive(
      this.drizzle.schema.appUser,
      eq(this.drizzle.schema.appUser.id, reporterId),
    )
    if (!existed) {
      throw new BadRequestException('举报人不存在')
    }
  }

  /**
   * 拦截举报自己内容的请求
   * @param reporterId - 举报人ID
   * @param ownerUserId - 目标所有者ID
   * @throws BadRequestException 当举报自己的内容时抛出异常
   */
  private ensureCanReportOwnTarget(reporterId: number, ownerUserId?: number) {
    if (ownerUserId && ownerUserId === reporterId) {
      throw new BadRequestException('不能举报自己')
    }
  }

  /**
   * 根据目标类型生成更明确的重复举报提示
   * @param targetType - 目标类型
   * @returns 重复举报提示信息
   */
  private getDuplicateMessage(targetType: ReportTargetTypeEnum) {
    switch (targetType) {
      case ReportTargetTypeEnum.COMIC:
      case ReportTargetTypeEnum.NOVEL:
        return '您已经举报过该作品，请勿重复举报'
      case ReportTargetTypeEnum.COMIC_CHAPTER:
      case ReportTargetTypeEnum.NOVEL_CHAPTER:
        return '您已经举报过该章节，请勿重复举报'
      case ReportTargetTypeEnum.FORUM_TOPIC:
        return '您已经举报过该主题，请勿重复举报'
      case ReportTargetTypeEnum.COMMENT:
        return '您已经举报过该评论，请勿重复举报'
      case ReportTargetTypeEnum.USER:
        return '您已经举报过该用户，请勿重复举报'
      default:
        return '您已经举报过该内容，请勿重复举报'
    }
  }
}
