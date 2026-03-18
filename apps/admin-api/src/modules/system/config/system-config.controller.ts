import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import {
  BaseSystemConfigDto,
  SystemConfigService,
} from '@libs/system-config'
import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  SystemConfigBodyDto,
} from './dto/system-config.dto'

@ApiTags('系统配置')
@Controller('admin/system')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('config-detail')
  @ApiDoc({
    summary: '获取系统配置',
    model: BaseSystemConfigDto,
  })
  async getConfig() {
    // 使用脱敏方法
    return this.systemConfigService.findMaskedConfig()
  }

  /**
   * 兼容任务清单要求的 /admin/system/config 路径
   */
  @Get('config')
  @ApiDoc({
    summary: '获取系统配置',
    model: BaseSystemConfigDto,
  })
  async getConfigByAlias() {
    return this.systemConfigService.findMaskedConfig()
  }

  @Post('config-update')
  @ApiDoc({
    summary: '更新系统配置',
    model: IdDto,
  })
  async updateConfig(
    @Body() dto: SystemConfigBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.systemConfigService.updateConfig(dto, userId)
  }
}
