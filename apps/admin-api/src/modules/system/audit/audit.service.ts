import type {
  AuditPageRequestDto,
  CreateRequestLogDto,
} from '@libs/platform/modules/audit/dto'
import type { FastifyRequest } from 'fastify'
import type { RequestLogInsert } from './audit.type'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'

import { GeoService } from '@libs/platform/modules/geo/geo.service'
import { buildRequestLogFields } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, eq, or } from 'drizzle-orm'
import {
  getAuditActionTypeLabel,
  normalizeAuditActionType,
  resolveAuditActionTypeSearchTerms,
} from './audit.helpers'

/**
 * 审计日志服务。
 * 负责记录与查询后台操作审计日志。
 */
@Injectable()
export class AuditService {
  // 复用请求日志表。
  get requestLog() {
    return this.drizzle.schema.requestLog
  }

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly geoService: GeoService,
  ) {}

  // 复用当前模块共享数据库连接。
  private get db() {
    return this.drizzle.db
  }

  private get auditPageSelect() {
    return {
      id: this.requestLog.id,
      createdAt: this.requestLog.createdAt,
      updatedAt: this.requestLog.updatedAt,
      userId: this.requestLog.userId,
      username: this.requestLog.username,
      apiType: this.requestLog.apiType,
      ip: this.requestLog.ip,
      method: this.requestLog.method,
      path: this.requestLog.path,
      params: this.requestLog.params,
      actionType: this.requestLog.actionType,
      isSuccess: this.requestLog.isSuccess,
      userAgent: this.requestLog.userAgent,
      device: this.requestLog.device,
      content: this.requestLog.content,
    }
  }

  // 创建请求日志，自动填充 IP 属地等请求上下文。
  async createRequestLog(createDto: CreateRequestLogDto, req: FastifyRequest) {
    const normalizedActionType = normalizeAuditActionType(createDto.actionType)
    const requestContext = await this.geoService.buildRequestContext(req)

    // 处理JSON字段的转换
    const data: RequestLogInsert = {
      ...createDto,
      actionType: normalizedActionType ?? undefined,
      ...buildRequestLogFields(requestContext),
    }
    const [created] = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.requestLog)
        .values(data)
        .returning({ id: this.requestLog.id }),
    )
    return created
  }

  // 分页获取请求日志列表，支持多维度过滤。
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
      userId ? eq(this.requestLog.userId, userId) : undefined,
      buildILikeCondition(this.requestLog.username, username),
      apiType ? eq(this.requestLog.apiType, apiType) : undefined,
      ip ? eq(this.requestLog.ip, ip) : undefined,
      method ? eq(this.requestLog.method, method) : undefined,
      buildILikeCondition(this.requestLog.path, path),
      actionTypeSearchTerms.length > 0
        ? or(
            ...actionTypeSearchTerms.map((term) =>
              eq(this.requestLog.actionType, term),
            ),
          )
        : undefined,
      isSuccess !== undefined
        ? eq(this.requestLog.isSuccess, isSuccess)
        : undefined,
    ].filter(Boolean)

    const where = whereParts.length > 0 ? and(...whereParts) : undefined
    const pageQuery = this.drizzle.buildPage(pageOptions)
    const orderQuery = this.drizzle.buildOrderBy(pageOptions.orderBy, {
      table: this.requestLog,
    })
    const [list, total] = await Promise.all([
      this.db
        .select(this.auditPageSelect)
        .from(this.requestLog)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.requestLog, where),
    ])
    const page = toPageResult(list, total, pageQuery)

    return {
      ...page,
      list: page.list.map((requestLog) => this.decorateRequestLog(requestLog)),
    }
  }

  // 装饰请求日志：补充 actionType 规范值与中文标签。
  private decorateRequestLog<T extends { actionType: number | null }>(
    requestLog: T,
  ) {
    return {
      ...requestLog,
      actionType: normalizeAuditActionType(requestLog.actionType),
      actionTypeLabel: getAuditActionTypeLabel(requestLog.actionType),
    }
  }
}
