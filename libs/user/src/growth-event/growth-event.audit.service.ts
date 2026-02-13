import type { UserGrowthEvent } from '@libs/base/database'
import { BaseService, Prisma } from '@libs/base/database'
import { jsonParse } from '@libs/base/utils/jsonParse'
import { Injectable } from '@nestjs/common'
import { QueryUserGrowthEventDto } from './dto/growth-event-query.dto'
import { UserGrowthEventDto } from './dto/growth-event.dto'
import { USER_GROWTH_EVENT_IDEMPOTENCY_WINDOW_SECONDS } from './growth-event.constant'
import { UserGrowthEventStatus } from './growth-event.types'

/**
 * 成长事件审计服务类
 * 负责事件幂等去重、落库与状态更新
 */
@Injectable()
export class UserGrowthEventAuditService extends BaseService {
  /**
   * 获取成长事件模型
   */
  get userGrowthEvent() {
    return this.prisma.userGrowthEvent
  }

  /**
   * 规范化上下文内容
   * @param context 原始上下文
   * @returns 解析后的上下文
   */
  private normalizeContext(context?: string) {
    if (context === undefined) {
      return undefined
    }
    // 尝试解析 JSON 字符串，失败则保留原文
    const parsed = jsonParse<unknown>(context, context)
    return parsed ?? context
  }

  /**
   * 查找幂等窗口内的重复事件
   * @param event 成长事件
   * @returns 重复事件或空
   */
  async findDuplicate(event: UserGrowthEventDto) {
    // 以事件发生时间为中心，使用幂等窗口查重
    const windowMs = USER_GROWTH_EVENT_IDEMPOTENCY_WINDOW_SECONDS * 1000
    const center = event.occurredAt.getTime()
    const start = new Date(center - windowMs)
    const end = new Date(center + windowMs)

    return this.userGrowthEvent.findFirst({
      where: {
        business: event.business,
        eventKey: event.eventKey,
        userId: event.userId,
        targetId: event.targetId ?? null,
        occurredAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        occurredAt: 'desc',
      },
    })
  }

  /**
   * 创建成长事件记录
   * @param event 成长事件
   * @param status 事件状态
   * @returns 事件记录
   */
  async createEvent(
    event: UserGrowthEventDto,
    status: UserGrowthEventStatus,
  ): Promise<UserGrowthEvent> {
    return this.userGrowthEvent.create({
      data: {
        business: event.business,
        eventKey: event.eventKey,
        userId: event.userId,
        targetId: event.targetId,
        ip: event.ip,
        deviceId: event.deviceId,
        occurredAt: event.occurredAt,
        status,
        context: this.normalizeContext(event.context),
      },
    })
  }

  /**
   * 更新事件处理状态与发放结果
   * @param id 事件ID
   * @param status 新状态
   * @param data 发放结果
   * @param data.ruleRefs 规则引用列表
   * @param data.pointsDeltaApplied 实际积分增量
   * @param data.experienceDeltaApplied 实际经验增量
   * @param data.badgeAssigned 发放徽章信息
   * @returns 更新后的事件
   */
  async updateStatus(
    id: number,
    status: UserGrowthEventStatus,
    data?: {
      ruleRefs?: Prisma.InputJsonValue
      pointsDeltaApplied?: number
      experienceDeltaApplied?: number
      badgeAssigned?: Prisma.InputJsonValue
    },
  ) {
    return this.userGrowthEvent.update({
      where: { id },
      data: {
        status,
        ruleRefs: data?.ruleRefs,
        pointsDeltaApplied: data?.pointsDeltaApplied,
        experienceDeltaApplied: data?.experienceDeltaApplied,
        badgeAssigned: data?.badgeAssigned,
      },
    })
  }

  /**
   * 分页查询成长事件
   * @param dto 查询条件
   * @returns 分页结果
   */
  async findPage(dto: QueryUserGrowthEventDto) {
    const {
      startDate,
      endDate,
      business,
      eventKey,
      userId,
      status,
      targetId,
      ip,
      deviceId,
    } = dto
    const where: Prisma.UserGrowthEventWhereInput = {
      business,
      eventKey,
      userId,
      status,
      targetId,
      ip,
      deviceId,
    }

    if (startDate || endDate) {
      const occurredAt: Prisma.DateTimeFilter = {}
      if (startDate) {
        const parsedStart = new Date(startDate)
        if (!Number.isNaN(parsedStart.getTime())) {
          occurredAt.gte = parsedStart
        }
      }
      if (endDate) {
        const parsedEnd = new Date(endDate)
        if (!Number.isNaN(parsedEnd.getTime())) {
          parsedEnd.setDate(parsedEnd.getDate() + 1)
          occurredAt.lt = parsedEnd
        }
      }
      if (Object.keys(occurredAt).length > 0) {
        where.occurredAt = occurredAt
      }
    }

    return this.userGrowthEvent.findPagination({
      where: {
        ...where,
        pageIndex: dto.pageIndex,
        pageSize: dto.pageSize,
        orderBy: dto.orderBy,
      },
    })
  }
}
