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

@ApiTags('系统管理/系统配置')
@Controller('admin/system')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('config')
  @ApiDoc({
    summary: '获取系统配置',
    model: BaseSystemConfigDto,
  })
  async getConfig() {
    return this.systemConfigService.findMaskedConfig()
  }

  @Post('update')
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
