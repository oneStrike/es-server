import { Injectable } from '@nestjs/common'
import { BaseRepositoryService } from '@/global/services/base-repository.service'
import { QueryRequestLogDto, RequestLogDto } from './dto/request-log.dto'

@Injectable()
export class RequestLogService extends BaseRepositoryService<'RequestLog'> {
  protected readonly modelName = 'RequestLog' as const

  /**
   * 分页查询请求日志列表
   * @param queryDto 查询参数
   * @returns 分页结果
   */
  async findRequestLogPage(queryDto: QueryRequestLogDto) {
    const { pageIndex, pageSize, userId, username, apiType, method, path, isSuccess, startTime, endTime } = queryDto

    const where: any = {}

    if (userId) {
      where.userId = userId
    }
    if (username) {
      where.username = { contains: username }
    }
    if (apiType) {
      where.apiType = apiType
    }
    if (method) {
      where.method = method
    }
    if (path) {
      where.path = { contains: path }
    }
    if (isSuccess !== undefined) {
      where.isSuccess = isSuccess
    }

    // 处理时间范围查询
    if (startTime || endTime) {
      where.createdAt = {}
      if (startTime) {
        where.createdAt.gte = startTime
      }
      if (endTime) {
        where.createdAt.lte = endTime
      }
    }

    return this.findPagination({
      pageIndex,
      pageSize,
      where,
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * 获取请求日志详情
   * @param id 日志ID
   * @returns 日志详情
   */
  async findRequestLogById(id: number) {
    return this.findById({ id })
  }

  /**
   * 创建请求日志
   * @param data 日志数据
   * @returns 创建的日志
   */
  async createRequestLog(data: RequestLogDto) {
    return this.create({ data })
  }
}
