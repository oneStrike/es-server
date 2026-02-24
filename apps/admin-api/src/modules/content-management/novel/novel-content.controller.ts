import type { FastifyRequest } from 'fastify'
import { ApiDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { FileUploadResponseDto } from '@libs/base/modules/upload'
import {
  NovelContentService,
  UploadChapterFileDto,
} from '@libs/content/work/content'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('内容管理/小说章节内容模块')
@Controller('admin/work/novel-content')
export class NovelContentController {
  constructor(private readonly novelContentService: NovelContentService) {}

  @Get('/content')
  @ApiDoc({
    summary: '获取章节内容',
    model: String,
  })
  async getContent(@Query() query: IdDto) {
    return this.novelContentService.getChapterContent(query.id)
  }

  @Post('/upload')
  @ApiDoc({
    summary: '上传章节文件',
    model: FileUploadResponseDto,
  })
  async upload(
    @Req() req: FastifyRequest,
    @Query() query: UploadChapterFileDto,
  ) {
    return this.novelContentService.uploadChapterContent(req, query)
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除章节文件',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.novelContentService.deleteChapterContent(body.id)
  }
}
