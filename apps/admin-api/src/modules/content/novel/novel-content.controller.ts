import type { FastifyRequest } from 'fastify'
import { NovelContentService } from '@libs/content/work'
import { ApiDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { UploadResponseDto } from '@libs/platform/modules/upload'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { UploadContentDto } from './dto/novel-content.dto'

@ApiTags('内容管理/小说管理/章节内容')
@Controller('admin/content/novel/chapter-content')
export class NovelContentController {
  constructor(private readonly novelContentService: NovelContentService) {}

  @Get('detail')
  @ApiDoc({
    summary: '获取章节内容',
    model: String,
  })
  async getContent(@Query() query: IdDto) {
    return this.novelContentService.getChapterContent(query.id)
  }

  @Post('upload')
  @ApiDoc({
    summary: '上传章节文件',
    model: UploadResponseDto,
  })
  async upload(@Req() req: FastifyRequest, @Query() query: UploadContentDto) {
    return this.novelContentService.uploadChapterContent(req, query)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除章节文件',
    model: Boolean,
  })
  async delete(@Body() body: IdDto) {
    return this.novelContentService.deleteChapterContent(body.id)
  }
}
