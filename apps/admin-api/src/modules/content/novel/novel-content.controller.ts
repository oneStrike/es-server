import type { FastifyRequest } from 'fastify'
import { UploadContentDto } from '@libs/content/work/content/dto/content.dto';
import { NovelContentService } from '@libs/content/work/content/novel-content.service';
import { ApiDoc } from '@libs/platform/decorators';
import { IdDto } from '@libs/platform/dto';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { UploadResponseDto } from '@libs/platform/modules/upload/dto'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

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
  @ApiAuditDoc({
    summary: '上传章节文件',
    model: UploadResponseDto,
    audit: {
      actionType: AuditActionTypeEnum.UPLOAD,
    },
  })
  async upload(@Req() req: FastifyRequest, @Query() query: UploadContentDto) {
    return this.novelContentService.uploadChapterContent(req, query)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除章节文件',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() body: IdDto) {
    return this.novelContentService.deleteChapterContent(body.id)
  }
}
