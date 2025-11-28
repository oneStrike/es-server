import type { FastifyRequest } from 'fastify'
import { ApiDoc } from '@libs/decorators'
import { UploadFileDto, UploadResponseDto } from '@libs/dto'
import { UploadService } from '@libs/upload'
import { Controller, Post, Query, Req } from '@nestjs/common'

import { ApiTags } from '@nestjs/swagger'

@ApiTags('管理端文件上传')
@Controller('admin/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('/upload-file')
  @ApiDoc({
    summary: '上传文件',
    model: UploadResponseDto,
    isArray: true,
  })
  async uploadMultiple(
    @Req() req: FastifyRequest,
    @Query() query: UploadFileDto,
  ) {
    return this.uploadService.uploadMultipleFiles(req, query.scene)
  }
}
