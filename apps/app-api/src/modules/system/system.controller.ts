import { AppConfigService } from '@libs/app-config/config.service';
import { BaseAppConfigDto } from '@libs/app-config/dto/config.dto';
import { AgreementService } from '@libs/app-content/agreement/agreement.service';
import { AgreementListItemDto, BaseAgreementDto, QueryPublishedAgreementDto } from '@libs/app-content/agreement/dto/agreement.dto';
import { AppAnnouncementService } from '@libs/app-content/announcement/announcement.service';
import { BaseAnnouncementDto, QueryAnnouncementDto } from '@libs/app-content/announcement/dto/announcement.dto';
import { BaseAppPageDto } from '@libs/app-content/page/dto/page.dto';
import { AppPageService } from '@libs/app-content/page/page.service';
import { AppUpdateService } from '@libs/app-content/update/update.service';
import { AppUpdateCheckDto, AppUpdateCheckResponseDto } from '@libs/app-content/update/dto/update.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { Public } from '@libs/platform/decorators/public.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Controller, Get, Query } from '@nestjs/common'
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

  @Get('update/check')
  @ApiDoc({
    summary: '检查 APP 更新',
    model: AppUpdateCheckResponseDto,
  })
  @Public()
  async checkUpdate(@Query() query: AppUpdateCheckDto) {
    return this.appUpdateService.checkUpdate(query)
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
    model: BaseAnnouncementDto,
  })
  @Public()
  async getAnnouncementPage(@Query() query: QueryAnnouncementDto) {
    return this.appAnnouncementService.findAnnouncementPage(query, {
      publishedOnly: true,
    })
  }

  @Get('agreement/list')
  @ApiDoc({
    summary: '协议列表',
    model: AgreementListItemDto,
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
    return this.agreementService.findOne(query, { publishedOnly: true })
  }
}
