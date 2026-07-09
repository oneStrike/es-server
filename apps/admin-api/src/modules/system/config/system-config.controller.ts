import { ApiDoc, CurrentUser } from '@libs/platform/decorators'

import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import {
  SystemConfigDetailDto,
  UpdateSystemConfigDto,
} from '@libs/system-config/dto/config.dto'
import { SystemConfigService } from '@libs/system-config/system-config.service'
import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

/**
 * 系统配置管理控制器
 * 只负责协议边界和审计，配置快照生成与敏感字段处理统一下沉到 service。
 */
@ApiTags('系统管理/系统配置')
@Controller('admin/system')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('config')
  @AdminPermission({
    code: 'system:config',
    name: '获取系统配置',
    groupCode: 'system',
  })
  @ApiDoc({
    summary: '获取系统配置',
    model: SystemConfigDetailDto,
  })
  async getConfig() {
    return this.systemConfigService.findMaskedConfig()
  }

  @Post('update')
  @AdminPermission({
    code: 'system:update',
    name: '更新系统配置',
    groupCode: 'system',
  })
  @ApiAuditDoc({
    summary: '更新系统配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateConfig(
    @Body() dto: UpdateSystemConfigDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.systemConfigService.updateConfig(dto, userId)
  }
}
