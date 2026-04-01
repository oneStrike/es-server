import { ReadingStateService } from '@libs/interaction/reading-state'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  ClearReadingHistoryDto,
  DeleteReadingHistoryDto,
  QueryReadingHistoryDto,
  ReadingHistoryWorkDto,
} from './dto/reading-history.dto'

@ApiTags('阅读记录')
@Controller('app/reading-history')
export class ReadingHistoryController {
  constructor(private readonly readingStateService: ReadingStateService) {}

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的阅读记录',
    model: ReadingHistoryWorkDto,
  })
  async myHistory(
    @Query() query: QueryReadingHistoryDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.readingStateService.getUserReadingHistory({
      ...query,
      userId,
    })
  }

  @Post('batch-delete')
  @ApiDoc({
    summary: '删除阅读记录',
    model: Boolean,
  })
  async delete(
    @Body() body: DeleteReadingHistoryDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.readingStateService.deleteUserReadingHistory(
      body.workIds,
      userId,
    )
  }

  @Post('clear')
  @ApiDoc({
    summary: '清空阅读记录',
    model: Boolean,
  })
  async clear(
    @Body() body: ClearReadingHistoryDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.readingStateService.clearUserReadingHistory(
      userId,
      body.workType,
    )
  }
}
