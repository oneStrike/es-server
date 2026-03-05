import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { DownloadService } from '@libs/interaction'
import {
  BaseUserDownloadRecordDto,
  DownloadedWorkChapterItemDto,
  DownloadedWorkItemDto,
  QueryDownloadedWorkChapterDto,
  QueryDownloadedWorkDto,
} from '@libs/interaction/download'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags, OmitType } from '@nestjs/swagger'

class AppQueryDownloadedWorkDto extends OmitType(QueryDownloadedWorkDto, [
  'userId',
]) {}

class AppQueryDownloadedWorkChapterDto extends OmitType(
  QueryDownloadedWorkChapterDto,
  ['userId'],
) {}

@ApiTags('作品模块/下载')
@Controller('app/work/download')
export class WorkDownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  @Get('works')
  @ApiPageDoc({
    summary: '分页查询已下载作品',
    model: DownloadedWorkItemDto,
  })
  async getDownloadedWorks(
    @Query() query: AppQueryDownloadedWorkDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.downloadService.getDownloadedWorks({
      ...query,
      userId,
    })
  }

  @Get('work-chapters')
  @ApiPageDoc({
    summary: '分页查询指定作品已下载章节',
    model: DownloadedWorkChapterItemDto,
  })
  async getDownloadedWorkChapters(
    @Query() query: AppQueryDownloadedWorkChapterDto,
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
    model: BaseUserDownloadRecordDto,
  })
  async downloadChapter(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.downloadService.downloadChapter(userId, body.id)
  }
}
