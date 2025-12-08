import type { RequestLogWhereInput } from '@libs/base/database'
import type { FastifyRequest } from 'fastify'
import { RepositoryService } from '@libs/base/database'
import { parseRequestLogFields } from '@libs/base/utils'
import { Injectable, NotFoundException } from '@nestjs/common'
import { ActionTypeEnum } from './audit.constant'
import {
  AuditPageRequestDto,
  CreateRequestLogDto,
  CreateRequestLogSimpleDto,
} from './dto/audit.dto'

@Injectable()
export class AuditService extends RepositoryService {
  get requestLog() {
    return this.prisma.requestLog
  }

  /**
   * 创建请求日志
   */
  async createRequestLog(createDto: CreateRequestLogDto, req: FastifyRequest) {
    // 处理JSON字段的转换
    const data = {
      ...createDto,
      ...parseRequestLogFields(req),
    }
    return this.requestLog.create({
      data,
      select: { id: true },
    })
  }

  /**
   * 创建成功请求日志的通用方法
   * @param actionType 操作类型
   * @param createDto 创建请求日志的数据
   * @param req FastifyRequest 对象
   * @returns 创建的请求日志ID
   */
  private async createSuccessRequestLog(
    actionType: ActionTypeEnum,
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
    const requestLog = await this.requestLog.findUnique({ where: { id } })

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

    // 构建查询条件
    const where: RequestLogWhereInput = {}

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

    if (actionType) {
      where.actionType = { contains: actionType, mode: 'insensitive' }
    }

    if (isSuccess !== undefined) {
      where.isSuccess = isSuccess
    }

    return this.requestLog.findPagination({
      where: { ...where, ...pageOptions },
    })
  }
}
