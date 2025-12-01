import { ApiPageDoc, Public } from '@libs/base/decorators'
import {
  LibsClientNoticeService,
  NoticePageResponseDto,
  QueryNoticeDto,
} from '@libs/client-config/notice'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * 客户端通知控制器
 * 提供通知相关的API接口
 */
@ApiTags('客户端通知模块')
@Controller('Client/notice')
export class ClientNoticeController {
  constructor(
    private readonly libsClientNoticeService: LibsClientNoticeService,
  ) {}

  /**
   * 分页查询通知列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询通知列表',
    model: NoticePageResponseDto,
  })
  @Public()
  async getPage(@Query() query: QueryNoticeDto) {
    return this.libsClientNoticeService.findNoticePage(query)
  }
}
