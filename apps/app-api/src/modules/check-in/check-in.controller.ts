import { CheckInService } from '@libs/growth/check-in/check-in.service'
import { QueryCheckInCalendarDetailDto } from '@libs/growth/check-in/dto/check-in-calendar-query.dto'
import {
  AppCheckInActionResponseDto,
  MakeupCheckInDto,
} from '@libs/growth/check-in/dto/check-in-execution.dto'
import {
  AppCheckInCalendarResponseDto,
  AppCheckInRecordItemDto,
  AppCheckInSummaryResponseDto,
  CheckInLeaderboardItemDto,
  QueryAppCheckInLeaderboardPageDto,
  QueryAppCheckInRecordPageDto,
  CheckInStreakDetailResponseDto,
} from '@libs/growth/check-in/dto/check-in-runtime.dto'
import {
  ApiCursorPageDoc,
  ApiDoc,
  CurrentUser,
} from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('签到')
@Controller('app/check-in')
export class CheckInController {
  // 注入签到门面服务，保持 controller 为协议层薄封装。
  constructor(private readonly checkInService: CheckInService) {}

  @Get('summary')
  @ApiDoc({
    summary: '获取当前签到摘要',
    model: AppCheckInSummaryResponseDto,
  })
  // 返回当前用户的签到摘要、补签摘要和连续签到摘要。
  async getSummary(@CurrentUser('sub') userId: number) {
    return this.checkInService.getSummary(userId)
  }

  @Get('streak/detail')
  @ApiDoc({
    summary: '获取连续签到详情',
    model: CheckInStreakDetailResponseDto,
  })
  // 返回当前用户的连续签到进度和当前生效奖励规则列表。
  async getStreakDetail(@CurrentUser('sub') userId: number) {
    return this.checkInService.getStreakDetail(userId)
  }

  @Get('calendar')
  @ApiDoc({
    summary: '获取当前周期签到日历',
    model: AppCheckInCalendarResponseDto,
  })
  // 返回当前补签周期内的签到日历视图。
  async getCalendar(@CurrentUser('sub') userId: number) {
    return this.checkInService.getCalendar(userId)
  }

  @Get('calendar/detail')
  @ApiDoc({
    summary: '获取目标日期所属周期的签到日历',
    model: AppCheckInCalendarResponseDto,
  })
  // 返回当前用户在目标日期所属周期内的签到日历视图。
  async getCalendarDetail(
    @Query() query: QueryCheckInCalendarDetailDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.getCalendarDetail(query, userId)
  }

  @Get('my/page')
  @ApiCursorPageDoc({
    summary: '分页获取我的签到记录',
    model: AppCheckInRecordItemDto,
  })
  // 分页返回当前用户的签到记录。
  async getMyRecords(
    @Query() query: QueryAppCheckInRecordPageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.getMyRecords(query, userId)
  }

  @Get('leaderboard/page')
  @ApiCursorPageDoc({
    summary: '分页获取签到排行榜',
    model: CheckInLeaderboardItemDto,
  })
  // 分页返回当前连续签到排行榜。
  async getLeaderboardPage(@Query() query: QueryAppCheckInLeaderboardPageDto) {
    return this.checkInService.getLeaderboardPage(query)
  }

  @Post('sign')
  @ApiDoc({
    summary: '今日签到',
    model: AppCheckInActionResponseDto,
  })
  // 为当前用户执行今天的签到动作。
  async sign(@CurrentUser('sub') userId: number) {
    return this.checkInService.signToday(userId)
  }

  @Post('makeup')
  @ApiDoc({
    summary: '补签',
    model: AppCheckInActionResponseDto,
  })
  // 为当前用户执行指定自然日的补签。
  async makeup(
    @Body() body: MakeupCheckInDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.makeup(body, userId)
  }
}
