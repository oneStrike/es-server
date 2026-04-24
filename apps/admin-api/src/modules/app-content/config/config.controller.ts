import { AppConfigService } from '@libs/app-config/config.service';
import { BaseAppConfigDto, UpdateAppConfigDto } from '@libs/app-config/dto/config.dto';
import { ApiDoc, CurrentUser } from '@libs/platform/decorators';

import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

/**
 * 应用配置管理控制器
 * 负责后台读取和更新唯一配置记录，不承载配置初始化逻辑。
 */
@ApiTags('APP管理/应用配置')
@Controller('admin/app-config')
export class AppConfigController {
  constructor(
    private readonly appConfigService: AppConfigService,
  ) { }

  @Get('active')
  @ApiDoc({
    summary: '获取最新应用配置',
    model: BaseAppConfigDto,
  })
  async findActive() {
    return this.appConfigService.findActiveConfig()
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新应用配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(
    @Body() body: UpdateAppConfigDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appConfigService.updateConfig(body, userId)
  }
}
