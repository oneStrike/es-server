import type { FastifyRequest } from 'fastify'
import { ApiDoc } from '@libs/platform/decorators/api-doc.decorator'
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Ip2regionRuntimeStatusDto } from '@libs/platform/modules/geo'
import { Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'
import { Ip2regionService } from './ip2region.service'

@ApiTags('系统管理/IP 属地库')
@Controller('admin/system/ip2region')
export class Ip2regionController {
  constructor(private readonly ip2regionService: Ip2regionService) {}

  @Get('status')
  @ApiDoc({
    summary: '获取当前 IP 属地库状态',
    model: Ip2regionRuntimeStatusDto,
  })
  async getStatus() {
    return this.ip2regionService.getStatus()
  }

  @Post('upload')
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
