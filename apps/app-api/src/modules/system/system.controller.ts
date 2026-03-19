import { AppConfigService, BaseAppConfigDto } from '@libs/app-config'
import {
  AgreementService,
  AppAnnouncementService,
  AppPageService,
  BaseAgreementDto,
  BaseAppPageDto,
} from '@libs/app-content'
import { ApiDoc, ApiPageDoc, Public } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AnnouncementPageResponseDto,
  ListOrPageAgreementResponseDto,
  QueryAnnouncementDto,
  QueryPublishedAgreementDto,
} from './dto/system-content.dto'

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
  ) {}

  @Get('config')
  @ApiDoc({
    summary: 'APP系统配置',
    model: BaseAppConfigDto,
  })
  @Public()
  async findActive() {
    return this.appConfigService.findActiveConfig()
  }

  @Get('page/list')
  @ApiDoc({
    summary: 'APP页面列表',
    model: BaseAppPageDto,
    isArray: true,
  })
  @Public()
  async listPages() {
    return this.appPageService.findActivePages()
  }

  @Get('announcement/page')
  @ApiPageDoc({
    summary: '系统公告',
    model: AnnouncementPageResponseDto,
  })
  @Public()
  async getAnnouncementPage(@Query() query: QueryAnnouncementDto) {
    return this.appAnnouncementService.findAnnouncementPage(query)
  }

  @Get('agreement/list')
  @ApiDoc({
    summary: '协议列表',
    model: ListOrPageAgreementResponseDto,
    isArray: true,
  })
  @Public()
  async getAllLatest(@Query() query: QueryPublishedAgreementDto) {
    return this.agreementService.getAllLatest(query)
  }

  @Get('agreement/detail')
  @ApiDoc({
    summary: '协议详情',
    model: BaseAgreementDto,
  })
  @Public()
  async findOne(@Query() query: IdDto) {
    return this.agreementService.findOne(query)
  }
}
