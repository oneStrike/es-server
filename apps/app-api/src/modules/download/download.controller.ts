import { DownloadService } from '@libs/interaction'

import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AppQueryDownloadedWorkChapterDto,
  AppQueryDownloadedWorkDto,
  DownloadedWorkChapterItemDto,
  DownloadedWorkItemDto,
  DownloadTargetDto,
} from './dto/download.dto'

@ApiTags('下载模块')
@Controller('app/download')
export class DownloadController {
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
