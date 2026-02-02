import { ApiDoc } from '@libs/base/decorators'
import { AliyunConfigDto, SystemConfigService } from '@libs/system-config'
import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('系统配置')
@Controller('admin/system')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('config-detail')
  @ApiDoc({
    summary: '获取系统配置',
    model: AliyunConfigDto,
  })
  async getConfig() {
    // 使用脱敏方法
    return this.systemConfigService.findMaskedConfig()
  }

  @Post('config-update')
  @ApiDoc({
    summary: '更新系统配置',
    model: { type: 'boolean' },
  })
  async updateConfig(@Body() dto: { aliyunConfig: AliyunConfigDto }) {
    return this.systemConfigService.updateConfig(dto)
  }
}
