import type { FastifyRequest } from 'fastify'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { UploadResponseDto } from '@libs/platform/modules/upload/dto'
import { UploadService } from '@libs/platform/modules/upload/upload.service'

import { Controller, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('系统管理/文件上传')
@Controller('admin/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file/upload')
  @ApiAuditDoc({
    summary: '上传文件',
    model: UploadResponseDto,
    isArray: false,
    audit: {
      actionType: AuditActionTypeEnum.UPLOAD,
    },
  })
  async uploadFile(@Req() req: FastifyRequest) {
    return this.uploadService.uploadFile(req)
  }
}
