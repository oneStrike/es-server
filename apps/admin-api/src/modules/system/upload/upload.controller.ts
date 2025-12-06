import type { FastifyRequest } from 'fastify'
import { ApiDoc } from '@libs/base/decorators'
import { UploadFileDto, UploadResponseDto } from '@libs/base/dto'
import { UploadService } from '@libs/base/modules'
import { Body, Controller, Post, Req } from '@nestjs/common'

import { ApiTags } from '@nestjs/swagger'

@ApiTags('管理端文件上传')
@Controller('admin/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('/upload-file')
  @ApiDoc({
    summary: '上传文件',
    model: UploadResponseDto,
    isArray: false,
  })
  async uploadFile(
    @Req() req: FastifyRequest,
    @Body() body: UploadFileDto,
  ) {
    return this.uploadService.uploadFile(req, body.scene)
  }
}
