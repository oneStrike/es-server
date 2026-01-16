import {
  LibAppNoticeService,
  NoticePageResponseDto,
  QueryNoticeDto,
} from '@libs/app-config/notice'
import { ApiPageDoc, Public } from '@libs/base/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('客户端通知模块')
@Controller('Client/notice')
export class AppNoticeController {
  constructor(
    private readonly libAppNoticeService: LibAppNoticeService,
  ) {}

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询通知列表',
    model: NoticePageResponseDto,
  })
  @Public()
  async getPage(@Query() query: QueryNoticeDto) {
    return this.libAppNoticeService.findNoticePage(query)
  }
}
