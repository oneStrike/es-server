import { DownloadService } from '@libs/interaction/download/download.service';
import { DownloadedWorkChapterItemDto, DownloadedWorkItemDto, DownloadTargetDto, QueryDownloadedWorkChapterDto, QueryDownloadedWorkDto } from '@libs/interaction/download/dto/download.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('下载')
@Controller('app/download')
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  @Get('work/page')
  @ApiPageDoc({
    summary: '分页查询已下载作品',
    model: DownloadedWorkItemDto,
  })
  async getDownloadedWorks(
    @Query() query: QueryDownloadedWorkDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.downloadService.getDownloadedWorks({
      ...query,
      userId,
    })
  }

  @Get('chapter/page')
  @ApiPageDoc({
    summary: '分页查询指定作品已下载章节',
    model: DownloadedWorkChapterItemDto,
  })
  async getDownloadedWorkChapters(
    @Query() query: QueryDownloadedWorkChapterDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.downloadService.getDownloadedWorkChapters({
      ...query,
      userId,
    })
  }

  @Post('chapter')
  @ApiDoc({
    summary: '下载章节（漫画/小说）',
    model: String,
  })
  async downloadChapter(
    @Body() body: DownloadTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.downloadService.downloadChapter({
      userId,
      ...body,
    })
  }
}
