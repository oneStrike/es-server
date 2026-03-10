import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  ClearReadingHistoryDto,
  QueryReadingHistoryDto,
  ReadingHistoryWorkDto,
  ReadingStateService,
} from '@libs/interaction'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('阅读模块')
@Controller('app/')
export class ReadingHistoryController {
  constructor(private readonly readingStateService: ReadingStateService) {}

  // @Get('my')
  // @ApiPageDoc({
  //   summary: '分页查询我的阅读历史',
  //   model: ReadingHistoryWorkDto,
  // })
  // async myHistory(
  //   @Query() query: QueryReadingHistoryDto,
  //   @CurrentUser('sub') userId: number,
  // ) {
  //   return this.readingStateService.getUserReadingHistory({
  //     ...query,
  //     userId,
  //   })
  // }

  @Post('delete')
  @ApiDoc({
    summary: '删除单条阅读历史',
    model: Boolean,
  })
  async delete(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.readingStateService.deleteUserReadingHistory(body.id, userId)
  }

  @Post('clear')
  @ApiDoc({
    summary: '清空阅读历史',
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
