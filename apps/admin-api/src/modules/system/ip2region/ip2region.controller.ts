import type { FastifyRequest } from 'fastify'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'

import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import { Ip2regionRuntimeStatusDto } from '@libs/platform/modules/geo/dto'
import { Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'
import { Ip2regionService } from './ip2region.service'

@ApiTags('系统管理/IP 属地库')
@Controller('admin/system/ip2region')
export class Ip2regionController {
  constructor(private readonly ip2regionService: Ip2regionService) {}

  @Get('status')
  @AdminPermission({
    code: 'system:ip2region:status',
    name: '获取当前 IP 属地库状态',
    groupCode: 'system:ip2region',
  })
  @ApiDoc({
    summary: '获取当前 IP 属地库状态',
    model: Ip2regionRuntimeStatusDto,
  })
  async getStatus() {
    return this.ip2regionService.getStatus()
  }

  @Post('upload')
  @AdminPermission({
    code: 'system:ip2region:upload',
    name: '上传 ip2region xdb 并热切换当前进程',
    groupCode: 'system:ip2region',
  })
  @ApiAuditDoc({
    summary: '上传 ip2region xdb 并热切换当前进程',
    model: Ip2regionRuntimeStatusDto,
    audit: {
      actionType: AuditActionTypeEnum.UPLOAD,
    },
  })
  async upload(@Req() req: FastifyRequest, @CurrentUser('sub') userId: number) {
    return this.ip2regionService.uploadAndActivate(req, userId)
  }
}
