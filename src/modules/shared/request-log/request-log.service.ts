import { Injectable, NotFoundException } from '@nestjs/common'
import { BaseRepositoryService } from '@/global/services/base-repository.service'
import { PrismaService } from '@/global/services/prisma.service'
import { CreateRequestLogDto, RequestLogPageDto } from './dto/request-log.dto'

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

    return this.findPagination({
      where,
      ...pageOptions,
      orderBy: { createdAt: 'desc' },
    })
  }
}
