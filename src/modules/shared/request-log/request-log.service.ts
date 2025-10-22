import type { RequestLogWhereInput } from '@/prisma/client/models'
import { Injectable, NotFoundException } from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { RepositoryService } from '@/common/services/repository.service'
import { parseRequestLogFields } from '@/utils'
import {
  CreateRequestLogDto,
  CreateRequestLogSimpleDto,
  RequestLogPageDto,
} from './dto/request-log.dto'
import { ActionTypeEnum } from './request-log.constant'

@Injectable()
export class RequestLogService extends RepositoryService {
  get requestLog() {
    return this.prisma.requestLog
  }

  /**
   * 创建请求日志
   * @param createDto 创建请求日志的数据
   * @returns 创建的请求日志ID
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
   * 创建失败请求日志的通用方法
   * @param actionType 操作类型
   * @param createDto 创建请求日志的数据
   * @param req FastifyRequest 对象
   * @returns 创建的请求日志ID
   */
  private async createFailureRequestLog(
    actionType: ActionTypeEnum,
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createRequestLog(
      { ...createDto, actionType, isSuccess: false },
      req,
    )
  }

  // 登录相关方法
  async createLoginSuccessRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createSuccessRequestLog(ActionTypeEnum.LOGIN, createDto, req)
  }

  async createLoginFailureRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createFailureRequestLog(ActionTypeEnum.LOGIN, createDto, req)
  }

  // 登出相关方法
  async createLogoutSuccessRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createSuccessRequestLog(ActionTypeEnum.LOGOUT, createDto, req)
  }

  async createLogoutFailureRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createFailureRequestLog(ActionTypeEnum.LOGOUT, createDto, req)
  }

  // 数据创建相关方法
  async createCreateSuccessRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createSuccessRequestLog(ActionTypeEnum.CREATE, createDto, req)
  }

  async createCreateFailureRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createFailureRequestLog(ActionTypeEnum.CREATE, createDto, req)
  }

  // 数据更新相关方法
  async createUpdateSuccessRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createSuccessRequestLog(ActionTypeEnum.UPDATE, createDto, req)
  }

  async createUpdateFailureRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createFailureRequestLog(ActionTypeEnum.UPDATE, createDto, req)
  }

  // 数据删除相关方法
  async createDeleteSuccessRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createSuccessRequestLog(ActionTypeEnum.DELETE, createDto, req)
  }

  async createDeleteFailureRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createFailureRequestLog(ActionTypeEnum.DELETE, createDto, req)
  }

  // 文件上传相关方法
  async createUploadSuccessRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createSuccessRequestLog(ActionTypeEnum.UPLOAD, createDto, req)
  }

  async createUploadFailureRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createFailureRequestLog(ActionTypeEnum.UPLOAD, createDto, req)
  }

  // 文件下载相关方法
  async createDownloadSuccessRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createSuccessRequestLog(ActionTypeEnum.DOWNLOAD, createDto, req)
  }

  async createDownloadFailureRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createFailureRequestLog(ActionTypeEnum.DOWNLOAD, createDto, req)
  }

  // 数据导出相关方法
  async createExportSuccessRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createSuccessRequestLog(ActionTypeEnum.EXPORT, createDto, req)
  }

  async createExportFailureRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createFailureRequestLog(ActionTypeEnum.EXPORT, createDto, req)
  }

  // 数据导入相关方法
  async createImportSuccessRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createSuccessRequestLog(ActionTypeEnum.IMPORT, createDto, req)
  }

  async createImportFailureRequestLog(
    createDto: CreateRequestLogSimpleDto,
    req: FastifyRequest,
  ) {
    return this.createFailureRequestLog(ActionTypeEnum.IMPORT, createDto, req)
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
  async getRequestLogPage(queryDto: RequestLogPageDto) {
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
