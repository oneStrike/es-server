import {
  CheckInActionResponseDto,
  CheckInCalendarResponseDto,
  CheckInRecordItemDto,
  CheckInService,
  CheckInSummaryResponseDto,
  MakeupCheckInDto,
  QueryMyCheckInRecordDto,
} from '@libs/growth/check-in'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('签到')
@Controller('app/check-in')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Get('summary')
  @ApiDoc({
    summary: '获取当前签到摘要',
    model: CheckInSummaryResponseDto,
  })
  async getSummary(@CurrentUser('sub') userId: number) {
    return this.checkInService.getSummary(userId)
  }

  @Get('calendar')
  @ApiDoc({
    summary: '获取当前周期签到日历',
    model: CheckInCalendarResponseDto,
  })
  async getCalendar(@CurrentUser('sub') userId: number) {
    return this.checkInService.getCalendar(userId)
  }

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页获取我的签到记录',
    model: CheckInRecordItemDto,
  })
  async getMyRecords(
    @Query() query: QueryMyCheckInRecordDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.getMyRecords(query, userId)
  }

  @Post('sign')
  @ApiDoc({
    summary: '今日签到',
    model: CheckInActionResponseDto,
  })
  async sign(@CurrentUser('sub') userId: number) {
    return this.checkInService.signToday(userId)
  }

  @Post('makeup')
  @ApiDoc({
    summary: '补签',
    model: CheckInActionResponseDto,
  })
  async makeup(
    @Body() body: MakeupCheckInDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.makeup(body, userId)
  }
}
