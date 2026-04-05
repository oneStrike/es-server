import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import {
  BaseSystemConfigDto,
  SystemConfigService,
  UpdateSystemConfigDto,
} from '@libs/system-config'
import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../audit/audit.constant'

/**
 * 系统配置管理控制器
 * 只负责协议边界和审计，配置快照生成与敏感字段处理统一下沉到 service。
 */
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
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新系统配置',
  })
  async updateConfig(
    @Body() dto: UpdateSystemConfigDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.systemConfigService.updateConfig(dto, userId)
  }
}
