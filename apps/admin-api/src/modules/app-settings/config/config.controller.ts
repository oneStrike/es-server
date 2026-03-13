import {
  AppConfigService,
  BaseAppConfigDto,
  UpdateAppConfigDto,
} from '@libs/app-settings'
import { ApiDoc } from '@libs/platform/decorators'
import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { ActionTypeEnum } from '../../system/audit/audit.constant'

@ApiTags('APP管理/应用配置')
@Controller('admin/app-config')
export class AppConfigController {
  constructor(
    private readonly appConfigService: AppConfigService,
  ) { }

  @Get('/active')
  @ApiDoc({
    summary: '获取最新应用配置',
    model: BaseAppConfigDto,
  })
  async findActive() {
    return this.appConfigService.findActiveConfig()
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新应用配置',
    model: BaseAppConfigDto,
  })
  @Audit({
    actionType: ActionTypeEnum.UPDATE,
    content: '更新应用配置',
  })
  async update(@Body() body: UpdateAppConfigDto) {
    return this.appConfigService.updateConfig(body)
  }
}
