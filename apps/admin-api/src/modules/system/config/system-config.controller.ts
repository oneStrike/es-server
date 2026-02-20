import { ApiDoc } from '@libs/base/decorators'
import { SystemConfigDto, SystemConfigService } from '@libs/system-config'
import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('系统配置')
@Controller('admin/system')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('config-detail')
  @ApiDoc({
    summary: '获取系统配置',
    model: SystemConfigDto,
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
    model: SystemConfigDto,
  })
  async getConfigByAlias() {
    return this.systemConfigService.findMaskedConfig()
  }

  @Post('config-update')
  @ApiDoc({
    summary: '更新系统配置',
    model: { type: 'boolean' },
  })
  async updateConfig(@Body() dto: SystemConfigDto) {
    return this.systemConfigService.updateConfig(dto)
  }

  /**
   * 兼容任务清单要求的 /admin/system/config 路径
   */
  @Post('config')
  @ApiDoc({
    summary: '更新系统配置',
    model: { type: 'boolean' },
  })
  async updateConfigByAlias(@Body() dto: SystemConfigDto) {
    return this.systemConfigService.updateConfig(dto)
  }
}
