import type { FastifyReply } from 'fastify'
import { AppConfigService } from '@libs/app-config/config.service'
import { AppConfigOutputDto } from '@libs/app-config/dto/config.dto'
import { sendAgreementHtml } from '@libs/app-content/agreement/agreement-html'
import { AgreementService } from '@libs/app-content/agreement/agreement.service'
import {
  AgreementListItemDto,
  AgreementOutputBaseDto,
  QueryPublishedAgreementDto,
} from '@libs/app-content/agreement/dto/agreement.dto'
import { AppAnnouncementService } from '@libs/app-content/announcement/announcement.service'
import {
  AnnouncementOutputBaseDto,
  AppAnnouncementListItemDto,
} from '@libs/app-content/announcement/dto/announcement.dto'
import { AppPageOutputDto } from '@libs/app-content/page/dto/page.dto'
import { AppPageService } from '@libs/app-content/page/page.service'
import {
  AppUpdateCheckDto,
  AppUpdateCheckResponseDto,
} from '@libs/app-content/update/dto/update.dto'
import { AppUpdateService } from '@libs/app-content/update/update.service'
import {
  ApiDoc,
  ApiHtmlDoc,
  ApiPageDoc,
  CurrentUser,
  Public,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { ConfigReader } from '@libs/system-config/config-reader'

import { WalletCurrencyDisplayConfigOutputDto } from '@libs/system-config/dto/config.dto'
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * 系统模块控制器
 * 提供APP系统配置、页面配置、公告、协议等公共信息的查询接口
 *
 * @class SystemController
 */
@ApiTags('系统')
@Controller('app/system')
export class SystemController {
  constructor(
    private readonly appAnnouncementService: AppAnnouncementService,
    private readonly agreementService: AgreementService,
    private readonly appConfigService: AppConfigService,
    private readonly appPageService: AppPageService,
    private readonly appUpdateService: AppUpdateService,
    private readonly configReader: ConfigReader,
  ) {}

  @Get('config')
  @ApiDoc({
    summary: 'APP系统配置',
    model: AppConfigOutputDto,
  })
  @Public()
  // 查询当前生效的 APP 系统配置。
  async findActive() {
    return this.appConfigService.findActiveConfig()
  }

  @Get('wallet-currency-display-config')
  @ApiDoc({
    summary: '钱包虚拟币展示配置',
    model: WalletCurrencyDisplayConfigOutputDto,
  })
  @Public()
  async getWalletCurrencyDisplayConfig() {
    return this.configReader.getWalletCurrencyDisplayConfig()
  }

  @Get('update/check')
  @ApiDoc({
    summary: '检查 APP 更新',
    model: AppUpdateCheckResponseDto,
  })
  @Public()
  // 检查当前客户端版本是否需要更新。
  async checkUpdate(@Query() query: AppUpdateCheckDto) {
    return this.appUpdateService.checkUpdate(query)
  }

  @Get('page/list')
  @ApiDoc({
    summary: 'APP页面列表',
    model: AppPageOutputDto,
    isArray: true,
  })
  @Public()
  // 查询当前启用的 APP 页面配置。
  async listPages() {
    return this.appPageService.findActivePages()
  }

  @Get('announcement/page')
  @ApiPageDoc({
    summary: '系统公告',
    model: AppAnnouncementListItemDto,
  })
  @Public()
  // 查询公开可见的已发布系统公告分页。
  async getAnnouncementPage(@Query() query: PageDto) {
    return this.appAnnouncementService.findPublicAnnouncementPage(query)
  }

  @Get('announcement/detail')
  @ApiDoc({
    summary: '系统公告详情',
    model: AnnouncementOutputBaseDto,
  })
  @Public()
  // 查询公开可见的系统公告详情。
  async getAnnouncementDetail(@Query() query: IdDto) {
    return this.appAnnouncementService.findPublicAnnouncementDetail(query)
  }

  @Post('announcement/read')
  @ApiDoc({
    summary: '标记系统公告已读',
    model: Boolean,
  })
  async markAnnouncementRead(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appAnnouncementService.markAnnouncementRead(body, userId)
  }

  @Post('announcement/view')
  @ApiDoc({
    summary: '记录系统公告浏览',
    model: Boolean,
  })
  // 当前用户首次浏览公开可见公告时才累加浏览量。
  async viewAnnouncement(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appAnnouncementService.incrementPublicAnnouncementViewCount(
      body,
      userId,
    )
  }

  @Get('agreement/list')
  @ApiDoc({
    summary: '协议列表',
    model: AgreementListItemDto,
    isArray: true,
  })
  @Public()
  // 查询公开可见的最新已发布协议列表。
  async getAllLatest(@Query() query: QueryPublishedAgreementDto) {
    return this.agreementService.getAllLatest(query)
  }

  @Get('agreement/detail')
  @ApiDoc({
    summary: '协议详情',
    model: AgreementOutputBaseDto,
  })
  @Public()
  // 查询公开可见的已发布协议详情。
  async findOne(@Query() query: IdDto) {
    return this.agreementService.findOne(query, { publishedOnly: true })
  }

  @Get('agreement/access')
  @ApiHtmlDoc({
    summary: '协议 HTML 访问页',
    description: '协议 HTML 页面',
    example: '<!doctype html><html lang="zh-CN">...</html>',
  })
  @Public()
  // 公开渲染已发布协议 HTML，未发布协议沿用公开详情的不可见语义。
  async accessAgreement(@Query() query: IdDto, @Res() reply: FastifyReply) {
    const agreement = await this.agreementService.findOne(query, {
      publishedOnly: true,
    })
    return sendAgreementHtml(reply, agreement)
  }
}
