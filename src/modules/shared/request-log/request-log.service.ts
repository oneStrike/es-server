import { Injectable, NotFoundException } from '@nestjs/common'
import { BaseRepositoryService } from '@/global/services/base-repository.service'
import { PrismaService } from '@/global/services/prisma.service'
import {
  CreateRequestLogDto,
  RequestLogPageDto,
  RequestLogStatsDto,
  UpdateRequestLogDto,
} from './dto/request-log.dto'

@Injectable()
export class RequestLogService extends BaseRepositoryService<'RequestLog'> {
  protected readonly modelName = 'RequestLog' as const

  constructor(protected readonly prisma: PrismaService) {
    super(prisma)
  }

  /**
   * 创建请求日志
   * @param createDto 创建请求日志的数据
   * @returns 创建的请求日志ID
   */
  async createRequestLog(createDto: CreateRequestLogDto) {
    // 处理JSON字段的转换
    const data = {
      ...createDto,
      params: createDto.params ? JSON.parse(createDto.params) : null,
      device: createDto.device ? JSON.parse(createDto.device) : null,
    }

    return this.create({
      data,
      select: { id: true },
    })
  }

  /**
   * 批量创建请求日志
   * @param createDtos 批量创建请求日志的数据数组
   * @returns 创建的记录数量
   */
  async createManyRequestLogs(createDtos: CreateRequestLogDto[]) {
    const data = createDtos.map((dto) => ({
      ...dto,
      params: dto.params ? JSON.parse(dto.params) : null,
      device: dto.device ? JSON.parse(dto.device) : null,
    }))

    return this.createMany({ data })
  }

  /**
   * 根据ID获取请求日志详情
   * @param id 请求日志ID
   * @returns 请求日志详情
   */
  async getRequestLogById(id: number) {
    const requestLog = await this.findById({ id })

    if (!requestLog) {
      throw new NotFoundException('请求日志不存在')
    }

    return requestLog
  }

  /**
   * 分页获取请求日志列表
   * @param queryDto 分页查询参数
   * @returns 分页结果
   */
  async getRequestLogPage(queryDto: RequestLogPageDto) {
    const {
      userId,
      username,
      apiType,
      ip,
      method,
      path,
      statusCode,
      actionType,
      isSuccess,
      content,
      ...pageOptions
    } = queryDto

    // 构建查询条件
    const where: any = {}

    if (userId) {
      where.userId = userId
    }

    if (username) {
      where.username = { contains: username, mode: 'insensitive' }
    }

    if (apiType) {
      where.apiType = apiType
    }

    if (ip) {
      where.ip = ip
    }

    if (method) {
      where.method = method
    }

    if (path) {
      where.path = { contains: path, mode: 'insensitive' }
    }

    if (statusCode) {
      where.statusCode = statusCode
    }

    if (actionType) {
      where.actionType = { contains: actionType, mode: 'insensitive' }
    }

    if (isSuccess !== undefined) {
      where.isSuccess = isSuccess
    }

    if (content) {
      where.content = { contains: content, mode: 'insensitive' }
    }

    return this.findPagination({
      where,
      ...pageOptions,
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 更新请求日志
   * @param id 请求日志ID
   * @param updateDto 更新数据
   * @returns 更新后的请求日志ID
   */
  async updateRequestLog(id: number, updateDto: UpdateRequestLogDto) {
    // 检查记录是否存在
    const existingLog = await this.findById({ id })
    if (!existingLog) {
      throw new NotFoundException('请求日志不存在')
    }

    // 处理JSON字段的转换
    const data = {
      ...updateDto,
      params: updateDto.params ? JSON.parse(updateDto.params) : undefined,
      device: updateDto.device ? JSON.parse(updateDto.device) : undefined,
    }

    return this.updateById({
      id,
      data,
      select: { id: true },
    })
  }

  /**
   * 删除请求日志
   * @param id 请求日志ID
   * @returns 删除的请求日志ID
   */
  async deleteRequestLog(id: number) {
    // 检查记录是否存在
    const existingLog = await this.findById({ id })
    if (!existingLog) {
      throw new NotFoundException('请求日志不存在')
    }

    return this.deleteById({
      id,
      select: { id: true },
    })
  }

  /**
   * 批量删除请求日志
   * @param ids 请求日志ID数组
   * @returns 删除的记录数量
   */
  async deleteManyRequestLogs(ids: number[]) {
    return this.deleteMany({
      id: { in: ids },
    })
  }

  /**
   * 根据条件删除过期日志
   * @param daysAgo 删除多少天前的日志
   * @returns 删除的记录数量
   */
  async deleteExpiredLogs(daysAgo: number = 30) {
    const expiredDate = new Date()
    expiredDate.setDate(expiredDate.getDate() - daysAgo)

    return this.deleteMany({
      createdAt: { lt: expiredDate },
    })
  }

  /**
   * 获取请求日志统计信息
   * @param startDate 开始日期（可选）
   * @param endDate 结束日期（可选）
   * @returns 统计信息
   */
  async getRequestLogStats(
    startDate?: string,
    endDate?: string,
  ): Promise<RequestLogStatsDto> {
    // 构建时间范围条件
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setDate(end.getDate() + 1)
      dateFilter.lt = end
    }

    const where =
      Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}

    // 获取总请求数和成功请求数
    const [totalRequests, successRequests] = await Promise.all([
      this.count(where),
      this.count({ ...where, isSuccess: true }),
    ])

    const failedRequests = totalRequests - successRequests
    const successRate =
      totalRequests > 0 ? (successRequests / totalRequests) * 100 : 0

    // 获取今日和昨日请求数
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const [todayRequests, yesterdayRequests] = await Promise.all([
      this.count({
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      }),
      this.count({
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      }),
    ])

    return {
      totalRequests,
      successRequests,
      failedRequests,
      successRate: Math.round(successRate * 100) / 100,
      todayRequests,
      yesterdayRequests,
    }
  }

  /**
   * 根据用户ID获取用户的请求日志
   * @param userId 用户ID
   * @param pageOptions 分页选项
   * @returns 用户的请求日志分页结果
   */
  async getUserRequestLogs(userId: number, pageOptions: RequestLogPageDto) {
    return this.findPagination({
      where: { userId },
      ...pageOptions,
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 获取热门API路径统计
   * @param limit 返回数量限制，默认10
   * @returns API路径访问统计
   */
  async getPopularApiPaths(limit: number = 10) {
    const result = await this.prisma.$queryRaw`
      SELECT 
        path,
        COUNT(*) as request_count,
        COUNT(CASE WHEN is_success = true THEN 1 END) as success_count,
        COUNT(CASE WHEN is_success = false THEN 1 END) as failed_count,
        ROUND(
          COUNT(CASE WHEN is_success = true THEN 1 END) * 100.0 / COUNT(*), 
          2
        ) as success_rate
      FROM request_log 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY path 
      ORDER BY request_count DESC 
      LIMIT ${limit}
    `

    return result
  }

  /**
   * 获取错误状态码统计
   * @returns 错误状态码统计
   */
  async getErrorStatusStats() {
    const result = await this.prisma.$queryRaw`
      SELECT 
        status_code,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM request_log WHERE status_code >= 400), 2) as percentage
      FROM request_log 
      WHERE status_code >= 400 
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY status_code 
      ORDER BY count DESC
    `

    return result
  }
}
