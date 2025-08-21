import type {
  LogExtras,
  LogOutcomeType,
  LogQueryFilters,
} from './request-log.types'
import type { Prisma } from '@/prisma/client/client'
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { PrismaService } from '@/global/services/prisma.service'
import { RequestContextStorage } from './request-context'

function normalizeOutcome(
  o?: LogOutcomeType | boolean,
): 'SUCCESS' | 'FAILURE' | null {
  if (o === true) {
    return 'SUCCESS'
  }
  if (o === false) {
    return 'FAILURE'
  }
  if (o === 'SUCCESS' || o === 'FAILURE') {
    return o
  }
  return null
}

@Injectable()
export class RequestLogService implements OnApplicationShutdown {
  private readonly logger = new Logger(RequestLogService.name)
  private buffer: Prisma.RequestLogCreateManyInput[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private readonly batchSize = 100
  private readonly flushIntervalMs = 1000

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 对外简洁 API：记录请求日志
   * 自动合并 AsyncLocalStorage 中的上下文信息
   */
  async logRequest(content: string, extras?: LogExtras): Promise<void> {
    try {
      const ctx = RequestContextStorage.get()
      const actionResult = normalizeOutcome(extras?.actionResult)
      const record: Prisma.RequestLogCreateManyInput = {
        content,
        actionType: extras?.actionType ?? undefined,
        actionResult: (actionResult as any) ?? undefined,
        errorMessage: extras?.errorMessage ?? undefined,
        statusCode: extras?.statusCode ?? ctx?.statusCode ?? undefined,
        method: extras?.method ?? ctx?.method ?? 'GET',
        path: extras?.path ?? ctx?.path ?? '/',
        ip: extras?.ip ?? ctx?.ip ?? undefined,
        userAgent: extras?.userAgent ?? ctx?.userAgent ?? undefined,
        userId: extras?.userId ?? ctx?.userId ?? undefined,
        username: extras?.username ?? ctx?.username ?? undefined,
        userType: extras?.userType ?? ctx?.userType ?? undefined,
        device: extras?.device ?? ctx?.device ?? undefined,
        params: extras?.params ?? ctx?.params ?? undefined,
        traceId: extras?.traceId ?? ctx?.traceId ?? undefined,
        responseTimeMs:
          extras?.responseTimeMs ?? ctx?.responseTimeMs ?? undefined,
        extras: extras?.extras ?? undefined,
      }

      this.buffer.push(record)
      if (this.buffer.length >= this.batchSize) {
        void this.flush()
      } else {
        this.ensureTimer()
      }
    } catch (e) {
      // 写日志不能影响业务流程
      this.logger.warn(
        `logRequest 捕获异常: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  /**
   * 基础查询：按时间范围、用户ID、操作类型筛选
   */
  async findLogs(filters: LogQueryFilters) {
    const page = Math.max(1, filters.page ?? 1)
    const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 20))
    const where: Prisma.RequestLogWhereInput = {}

    if (filters.startAt || filters.endAt) {
      where.createdAt = {}
      if (filters.startAt) {
        ;(where.createdAt as any).gte = filters.startAt
      }
      if (filters.endAt) {
        ;(where.createdAt as any).lte = filters.endAt
      }
    }
    if (typeof filters.userId === 'number') {
      where.userId = filters.userId
    }
    if (filters.actionType) {
      where.actionType = filters.actionType
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.requestLog.count({ where }),
      this.prisma.requestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return {
      total,
      page,
      pageSize,
      items,
    }
  }

  /**
   * 立即刷新缓冲区（批量写库）
   */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    if (this.buffer.length === 0) {
      return
    }

    const batch = this.buffer
    this.buffer = []

    try {
      await this.prisma.requestLog.createMany({
        data: batch,
        skipDuplicates: false,
      })
    } catch (e) {
      // 不抛出，避免影响业务。记录错误并丢弃本批次，后续批次继续。
      this.logger.error(
        `批量写入请求日志失败: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  private ensureTimer() {
    if (this.flushTimer) {
      return
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, this.flushIntervalMs)
    // 避免阻止 Node 退出
    if (typeof this.flushTimer.unref === 'function') {
      this.flushTimer.unref()
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.flush()
  }
}
