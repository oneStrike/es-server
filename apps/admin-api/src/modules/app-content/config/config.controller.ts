import {
  AppConfigService,
  BaseAppConfigDto,
  UpdateAppConfigDto,
} from '@libs/app-config'
import { ApiDoc } from '@libs/platform/decorators'
import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'

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
  @ApiDoc({
    summary: '更新应用配置',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新应用配置',
  })
  async update(@Body() body: UpdateAppConfigDto) {
    return this.appConfigService.updateConfig(body)
  }
}
