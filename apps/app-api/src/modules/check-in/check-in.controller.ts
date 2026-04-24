import { CheckInService } from '@libs/growth/check-in/check-in.service'
import { CheckInCalendarDetailResponseDto } from '@libs/growth/check-in/dto/check-in-calendar-app.dto'
import { QueryCheckInCalendarDetailDto } from '@libs/growth/check-in/dto/check-in-calendar-query.dto'
import {
  CheckInActionResponseDto,
  MakeupCheckInDto,
} from '@libs/growth/check-in/dto/check-in-execution.dto'
import {
  CheckInCalendarResponseDto,
  CheckInLeaderboardItemDto,
  CheckInRecordItemDto,
  CheckInSummaryResponseDto,
  QueryCheckInLeaderboardDto,
} from '@libs/growth/check-in/dto/check-in-runtime.dto'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
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
    model: CheckInSummaryResponseDto,
  })
  // 返回当前用户的签到摘要、补签摘要和连续签到摘要。
  async getSummary(@CurrentUser('sub') userId: number) {
    return this.checkInService.getSummary(userId)
  }

  @Get('calendar')
  @ApiDoc({
    summary: '获取当前周期签到日历',
    model: CheckInCalendarResponseDto,
  })
  // 返回当前补签周期内的签到日历视图。
  async getCalendar(@CurrentUser('sub') userId: number) {
    return this.checkInService.getCalendar(userId)
  }

  @Get('calendar/detail')
  @ApiDoc({
    summary: '获取目标日期所属周期的签到日历',
    model: CheckInCalendarDetailResponseDto,
  })
  // 返回当前用户在目标日期所属周期内的签到日历视图。
  async getCalendarDetail(
    @Query() query: QueryCheckInCalendarDetailDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.getCalendarDetail(query, userId)
  }

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页获取我的签到记录',
    model: CheckInRecordItemDto,
  })
  // 分页返回当前用户的签到记录。
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
  // 分页返回当前连续签到排行榜。
  async getLeaderboardPage(@Query() query: QueryCheckInLeaderboardDto) {
    return this.checkInService.getLeaderboardPage(query)
  }

  @Post('sign')
  @ApiDoc({
    summary: '今日签到',
    model: CheckInActionResponseDto,
  })
  // 为当前用户执行今天的签到动作。
  async sign(@CurrentUser('sub') userId: number) {
    return this.checkInService.signToday(userId)
  }

  @Post('makeup')
  @ApiDoc({
    summary: '补签',
    model: CheckInActionResponseDto,
  })
  // 为当前用户执行指定自然日的补签。
  async makeup(
    @Body() body: MakeupCheckInDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.makeup(body, userId)
  }
}
