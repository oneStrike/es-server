import { CheckInService } from '@libs/growth/check-in/check-in.service'
import {
  CheckInActionResponseDto,
  MakeupCheckInDto,
} from '@libs/growth/check-in/dto/check-in-execution.dto'
import { QueryCheckInActivityStreakPageDto } from '@libs/growth/check-in/dto/check-in-definition.dto'
import {
  CheckInActivityStreakDetailResponseDto,
  CheckInActivityStreakItemDto,
  CheckInCalendarResponseDto,
  CheckInLeaderboardItemDto,
  CheckInRecordItemDto,
  CheckInSummaryResponseDto,
  QueryCheckInLeaderboardDto,
} from '@libs/growth/check-in/dto/check-in-runtime.dto'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IdDto } from '@libs/platform/dto/base.dto'
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
    @Query() query: PageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.getMyRecords(query, userId)
  }

  @Get('leaderboard/page')
  @ApiPageDoc({
    summary: '分页获取签到排行榜',
    model: CheckInLeaderboardItemDto,
  })
  async getLeaderboardPage(@Query() query: QueryCheckInLeaderboardDto) {
    return this.checkInService.getLeaderboardPage(query)
  }

  @Get('activity/page')
  @ApiPageDoc({
    summary: '分页获取活动连续签到列表',
    model: CheckInActivityStreakItemDto,
  })
  async getActivityPage(
    @Query() query: QueryCheckInActivityStreakPageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.getActivityPage(query, userId)
  }

  @Get('activity/detail')
  @ApiDoc({
    summary: '获取活动连续签到详情',
    model: CheckInActivityStreakDetailResponseDto,
  })
  async getActivityDetail(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.getActivityDetail(query, userId)
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
