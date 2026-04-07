import type { AuditPageRequestDto, CreateRequestLogDto, CreateRequestLogSimpleDto } from '@libs/platform/modules/audit/dto/audit.dto';
import type { FastifyRequest } from 'fastify'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { GeoService } from '@libs/platform/modules/geo';
import { buildRequestLogFields } from '@libs/platform/utils';
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, or } from 'drizzle-orm'
import { AuditActionTypeEnum } from './audit.constant'
import {
  getAuditActionTypeLabel,
  normalizeAuditActionType,
  resolveAuditActionTypeSearchTerms,
} from './audit.helpers'

/**
 * 审计日志服务
 * 负责记录与查询后台操作审计日志
 */
@Injectable()
export class AuditService {
  get systemRequestLog() {
    return this.drizzle.schema.systemRequestLog
  }

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly geoService: GeoService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 创建请求日志
   */
  async createRequestLog(createDto: CreateRequestLogDto, req: FastifyRequest) {
    const normalizedActionType = normalizeAuditActionType(createDto.actionType)
    const requestContext = await this.geoService.buildRequestContext(req)

    // 处理JSON字段的转换
    const data = {
      ...createDto,
      actionType: normalizedActionType ?? undefined,
      ...buildRequestLogFields(requestContext),
    } as any
    const [created] = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.systemRequestLog)
        .values(data)
        .returning({ id: this.systemRequestLog.id }),
    )
    return created
  }

  /**
   * 创建成功请求日志的通用方法
   * @param actionType 操作类型
   * @param createDto 创建请求日志的数据
   * @param req FastifyRequest 对象
   * @returns 创建的请求日志ID
   */
  private async createSuccessRequestLog(
    actionType: AuditActionTypeEnum,
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createRequestLog(
      { ...createDto, actionType, isSuccess: true },
      req,
    )
  }

  /**
   * 根据ID获取请求日志详情
   * @param id 请求日志ID
   * @returns 请求日志详情
   */
  async getRequestLogById(id: number) {
    const [systemRequestLog] = await this.db
      .select()
      .from(this.systemRequestLog)
      .where(eq(this.systemRequestLog.id, id))
      .limit(1)

    if (!systemRequestLog) {
      throw new NotFoundException('请求日志不存在')
    }

    return this.decorateRequestLog(systemRequestLog)
  }

  /**
   * 分页获取请求日志列表
   * @param queryDto 分页查询参数
   * @returns 分页结果
   */
  async getAuditPage(queryDto: AuditPageRequestDto) {
    const {
      userId,
      username,
      apiType,
      ip,
      method,
      path,
      actionType,
      isSuccess,
      ...pageOptions
    } = queryDto
    const actionTypeSearchTerms = actionType
      ? resolveAuditActionTypeSearchTerms(actionType)
      : []

    const whereParts = [
      userId ? eq(this.systemRequestLog.userId, userId) : undefined,
      buildILikeCondition(this.systemRequestLog.username, username),
      apiType ? eq(this.systemRequestLog.apiType, apiType) : undefined,
      ip ? eq(this.systemRequestLog.ip, ip) : undefined,
      method ? eq(this.systemRequestLog.method, method) : undefined,
      buildILikeCondition(this.systemRequestLog.path, path),
      actionTypeSearchTerms.length > 0
        ? or(
            ...actionTypeSearchTerms.map((term) =>
              eq(this.systemRequestLog.actionType, term),
            ),
          )
        : undefined,
      isSuccess !== undefined ? eq(this.systemRequestLog.isSuccess, isSuccess) : undefined,
    ].filter(Boolean)

    const page = await this.drizzle.ext.findPagination(this.systemRequestLog, {
      where: whereParts.length > 0 ? and(...whereParts) : undefined,
      ...pageOptions,
    })

    return {
      ...page,
      list: page.list.map((systemRequestLog) => this.decorateRequestLog(systemRequestLog)),
    }
  }

  private decorateRequestLog<T extends { actionType: string | null }>(
    systemRequestLog: T,
  ) {
    return {
      ...systemRequestLog,
      actionType: normalizeAuditActionType(systemRequestLog.actionType),
      actionTypeLabel: getAuditActionTypeLabel(systemRequestLog.actionType),
    }
  }
}
