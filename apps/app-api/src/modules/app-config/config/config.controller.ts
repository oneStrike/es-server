import {
  AppConfigService,
  BaseAppConfigDto,
} from '@libs/app-config/config'
import { ApiDoc, Public } from '@libs/base/decorators'
import { Controller, Get, } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('APP管理/应用配置')
@Controller('app/config')
export class AppConfigController {
  constructor(
    private readonly appConfigService: AppConfigService,
  ) { }

  @Get('/active')
  @ApiDoc({
    summary: '获取最新应用配置',
    model: BaseAppConfigDto,
  })
  @Public()
  async findActive() {
    return this.appConfigService.findActiveConfig()
  }
}
