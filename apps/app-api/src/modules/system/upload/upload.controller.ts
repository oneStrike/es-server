import type { FastifyRequest } from 'fastify'
import { ApiDoc } from '@libs/platform/decorators'
import { UploadResponseDto } from '@libs/platform/modules/upload/dto'
import { UploadService } from '@libs/platform/modules/upload/upload.service'

import { Controller, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('文件上传')
@Controller('app/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file/upload')
  @ApiDoc({
    summary: '上传文件',
    model: UploadResponseDto,
  })
  async uploadFile(@Req() req: FastifyRequest) {
    return this.uploadService.uploadFile(req)
  }
}
