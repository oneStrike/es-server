import { ApiDoc } from '@libs/base/decorators'
import { AliyunConfigDto, SystemConfigService } from '@libs/system-config'
import { Body, Controller, Get, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('系统配置')
@Controller('admin/system/config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @ApiDoc({
    summary: '获取系统配置',
    model: AliyunConfigDto,
  })
  async getConfig() {
    // 使用脱敏方法
    return this.systemConfigService.findMaskedConfig()
  }

  @Put()
  @ApiDoc({
    summary: '更新系统配置',
    model: { type: 'boolean' },
  })
  async updateConfig(@Body() dto: { aliyunConfig: AliyunConfigDto }) {
    return this.systemConfigService.updateConfig(dto)
  }
}
