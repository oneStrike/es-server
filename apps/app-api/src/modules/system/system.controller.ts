import {
  AgreementService,
  BaseAgreementDto,
  ListOrPageAgreementResponseDto,
  QueryPublishedAgreementDto,
} from '@libs/app-config/agreement'
import {
  AnnouncementPageResponseDto,
  AppAnnouncementService,
  QueryAnnouncementDto,
} from '@libs/app-config/announcement'
import { AppConfigService, BaseAppConfigDto } from '@libs/app-config/config'
import { AppPageResponseDto, AppPageService } from '@libs/app-config/page'
import { ApiDoc, ApiPageDoc, Public } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('系统模块')
@Controller('app/system')
export class SystemController {
  constructor(
    private readonly appAnnouncementService: AppAnnouncementService,
    private readonly agreementService: AgreementService,
    private readonly appConfigService: AppConfigService,
    private readonly appPageService: AppPageService,
  ) {}

  @Get('/config')
  @ApiDoc({
    summary: 'APP系统配置',
    model: BaseAppConfigDto,
  })
  @Public()
  async findActive() {
    return this.appConfigService.findActiveConfig()
  }

  @Get('/page')
  @ApiPageDoc({
    summary: 'APP页面配置',
    model: AppPageResponseDto,
  })
  @Public()
  async findPage() {
    return this.appPageService.findActivePages()
  }

  @Get('/announcement')
  @ApiPageDoc({
    summary: '系统公告',
    model: AnnouncementPageResponseDto,
  })
  @Public()
  async getAnnouncementPage(@Query() query: QueryAnnouncementDto) {
    return this.appAnnouncementService.findAnnouncementPage(query)
  }

  @Get('/agreement')
  @ApiDoc({
    summary: '协议列表',
    model: ListOrPageAgreementResponseDto,
    isArray: true,
  })
  @Public()
  async getAllLatest(@Query() query: QueryPublishedAgreementDto) {
    return this.agreementService.getAllLatest(query)
  }

  @Get('/agreement-detail')
  @ApiDoc({
    summary: '协议详情',
    model: BaseAgreementDto,
  })
  @Public()
  async findOne(@Query() query: IdDto) {
    return this.agreementService.findOne(query)
  }
}
