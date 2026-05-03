import type { FastifyReply } from 'fastify'
import { sendAgreementHtml } from '@libs/app-content/agreement/agreement-html'
import { AgreementService } from '@libs/app-content/agreement/agreement.service'
import {
  AdminAgreementDetailDto,
  AdminAgreementListItemDto,
  CreateAgreementDto,
  QueryAgreementDto,
  UpdateAgreementDto,
} from '@libs/app-content/agreement/dto/agreement.dto'
import {
  ApiDoc,
  ApiHtmlDoc,
  ApiPageDoc,
  Public,
} from '@libs/platform/decorators'
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

/**
 * 协议管理控制器
 * 提供协议的创建、更新、发布状态切换和查询接口
 *
 * @class AgreementController
 */
@ApiTags('APP管理/协议管理')
@Controller('admin/agreement')
export class AgreementController {
  // 注入协议服务与配置读取器。
  constructor(
    private readonly agreementService: AgreementService,
    private readonly configService: ConfigService,
  ) {}

  @Post('create')
  @ApiAuditDoc({
    summary: '创建协议',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  // 创建协议草稿。
  async create(@Body() dto: CreateAgreementDto) {
    return this.agreementService.create(dto)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新协议',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 更新未发布协议的主体字段。
  async update(@Body() dto: UpdateAgreementDto) {
    return this.agreementService.update(dto)
  }

  @Post('update-status')
  @ApiAuditDoc({
    summary: '更新协议发布状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 切换协议发布状态。
  async updateStatus(@Body() dto: UpdatePublishedStatusDto) {
    return this.agreementService.updatePublishStatus(dto)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '查询协议分页',
    model: AdminAgreementListItemDto,
  })
  // 查询协议分页并补充相对访问路径。
  async list(@Query() query: QueryAgreementDto) {
    const page = await this.agreementService.findPage(query)

    return {
      ...page,
      list: page.list.map((agreement) => this.withAccessPath(agreement)),
    }
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取协议详情',
    model: AdminAgreementDetailDto,
  })
  // 获取协议详情并补充相对访问路径。
  async detail(@Query() query: IdDto) {
    const agreement = await this.agreementService.findOne(query)
    return this.withAccessPath(agreement)
  }

  @Get('access')
  @Public()
  @ApiHtmlDoc({
    summary: '协议 HTML 访问页',
    description: '协议 HTML 页面',
    example: '<!doctype html><html lang="zh-CN">...</html>',
  })
  // 公开渲染协议 HTML，按已确认契约不判断发布状态。
  async access(@Query() query: IdDto, @Res() reply: FastifyReply) {
    const agreement = await this.agreementService.findOne(query)
    return sendAgreementHtml(reply, agreement)
  }

  // 为 admin 协议响应补充相对访问路径。
  private withAccessPath<TAgreement extends IdDto>(agreement: TAgreement) {
    return {
      ...agreement,
      accessPath: this.buildAccessPath(agreement.id),
    }
  }

  // 访问路径跟随全局 API 前缀。
  private buildAccessPath(agreementId: number) {
    const globalApiPrefix = this.normalizePathSegment(
      this.configService.get<string>('app.globalApiPrefix') ?? 'api',
    )
    const prefixPath = globalApiPrefix ? `/${globalApiPrefix}` : ''

    return `${prefixPath}/admin/agreement/access?id=${encodeURIComponent(
      String(agreementId),
    )}`
  }

  // 规范化配置中的路径片段。
  private normalizePathSegment(value: string) {
    return value.trim().replace(/^\/+|\/+$/g, '')
  }
}
