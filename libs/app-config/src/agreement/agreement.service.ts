import {
  AppAgreementUpdateInput,
  AppAgreementWhereInput,
  BaseService,
} from '@libs/base/database'

import { IdDto, UpdatePublishedStatusDto } from '@libs/base/dto'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  CreateAgreementDto,
  QueryAgreementDto,
  QueryPublishedAgreementDto,
  UpdateAgreementDto,
} from './dto/agreement.dto'

/**
 * 协议管理服务
 * 负责应用协议的新增、更新、发布与查询
 */
@Injectable()
export class AgreementService extends BaseService {
  constructor() {
    super()
  }

  get agreement() {
    return this.prisma.appAgreement
  }

  get agreementLog() {
    return this.prisma.appAgreementLog
  }

  /**
   * 创建协议
   */
  async create(dto: CreateAgreementDto) {
    if (
      await this.agreement.findFirst({
        where: { title: dto.title, version: dto.version },
      })
    ) {
      throw new BadRequestException('协议已存在')
    }

    return this.agreement.create({
      data: {
        title: dto.title,
        content: dto.content,
        version: dto.version,
        isForce: dto.isForce ?? false,
        showInAuth: dto.showInAuth ?? false,
      },
      select: { id: true },
    })
  }

  /**
   * 更新协议
   */
  async update(dto: UpdateAgreementDto) {
    if (!(await this.agreement.exists({ id: dto.id }))) {
      throw new NotFoundException('协议不存在')
    }

    const data: AppAgreementUpdateInput = {
      ...dto,
    }

    // 如果设置为发布自动填充发布时间
    if (dto.isPublished === true) {
      data.publishedAt = new Date()
    }

    return this.agreement.update({
      where: { id: dto.id },
      data,
      select: { id: true },
    })
  }

  /**
   * 更新协议状态
   */
  async updatePublishStatus(dto: UpdatePublishedStatusDto) {
    if (!(await this.agreement.exists({ id: dto.id }))) {
      throw new NotFoundException('协议不存在')
    }

    return this.agreement.update({
      where: { id: dto.id },
      data: { isPublished: dto.isPublished },
      select: { id: true },
    })
  }

  /**
   * 删除协议
   */
  async delete({ id }: IdDto) {
    if (!(await this.agreement.exists({ id }))) {
      throw new NotFoundException('协议不存在')
    }
    return this.agreement.delete({ where: { id }, select: { id: true } })
  }

  /**
   * 获取协议详情
   */
  async findOne({ id }: IdDto) {
    const agreement = await this.agreement.findUnique({
      where: { id },
    })
    if (!agreement) {
      throw new NotFoundException('协议不存在')
    }
    return agreement
  }

  /**
   * 分页查询协议
   */
  async findPage(query: QueryAgreementDto) {
    const { title, ...otherDto } = query
    const where: AppAgreementWhereInput = {}

    if (title) {
      where.title = {
        contains: title,
      }
    }

    return this.agreement.findPagination({
      where: { title, ...otherDto },
      omit: { content: true },
    })
  }

  /**
   * 获取最新已发布的所有协议
   */
  async getAllLatest(dto: QueryPublishedAgreementDto) {
    return this.agreement.findMany({
      where: { isPublished: true, showInAuth: dto.showInAuth },
      omit: { content: true },
    })
  }
}
