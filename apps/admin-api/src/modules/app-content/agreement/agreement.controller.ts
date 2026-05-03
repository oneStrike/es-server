import type { FastifyReply } from 'fastify'
import { AgreementService } from '@libs/app-content/agreement/agreement.service'
import {
  AdminAgreementDetailDto,
  AdminAgreementListItemDto,
  BaseAgreementDto,
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

const AGREEMENT_HTML_CSP =
  "default-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; img-src https: data:; media-src https: data:; style-src 'unsafe-inline'"

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
    return reply
      .header('Content-Security-Policy', AGREEMENT_HTML_CSP)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('Cache-Control', 'no-store')
      .header('X-Robots-Tag', 'noindex, nofollow, noarchive')
      .type('text/html; charset=utf-8')
      .send(this.renderAgreementHtml(agreement))
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

  // 渲染协议 HTML 壳，正文保持后台维护内容直出。
  private renderAgreementHtml(agreement: BaseAgreementDto) {
    const title = this.escapeHtml(agreement.title)
    const version = this.escapeHtml(agreement.version)

    return [
      '<!doctype html>',
      '<html lang="zh-CN">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${title}</title>`,
      '<style>',
      'body{margin:0;background:#f7f8fa;color:#1f2933;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7;}',
      'main{max-width:760px;margin:0 auto;padding:28px 18px 48px;background:#fff;min-height:100vh;}',
      'h1{font-size:24px;line-height:1.35;margin:0 0 8px;}',
      '.meta{color:#6b7280;font-size:13px;margin:0 0 24px;}',
      '.content{font-size:16px;overflow-wrap:anywhere;}',
      '.content img,.content video{max-width:100%;height:auto;}',
      '</style>',
      '</head>',
      '<body>',
      '<main>',
      `<h1>${title}</h1>`,
      `<p class="meta">版本：${version}</p>`,
      `<article class="content">${agreement.content}</article>`,
      '</main>',
      '</body>',
      '</html>',
    ].join('')
  }

  // 转义页面壳字段，避免标题和版本号破坏 HTML 结构。
  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
}
