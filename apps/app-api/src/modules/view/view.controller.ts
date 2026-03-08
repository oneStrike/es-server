import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  ClearUserViewDto,
  QueryUserViewDto,
  RecordViewDto,
  ViewService,
} from '@libs/interaction'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('浏览模块')
@Controller('app/view')
export class ViewController {
  constructor(private readonly viewService: ViewService) {}

  @Post('record')
  @ApiDoc({
    summary: '记录浏览',
    model: Boolean,
  })
  async record(@Body() body: RecordViewDto, @CurrentUser('sub') userId: number) {
    await this.viewService.recordView(
      body.targetType,
      body.targetId,
      userId,
      body.ipAddress,
      body.device,
      body.userAgent,
    )
    return { success: true }
  }

  @Get('my')
  @ApiPageDoc({
    summary: '分页查询我的浏览记录',
    model: IdDto,
  })
  async my(@Query() query: QueryUserViewDto, @CurrentUser('sub') userId: number) {
    return this.viewService.getUserViews(
      userId,
      query.targetType,
      query.pageIndex,
      query.pageSize,
    )
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除单条浏览记录',
    model: Boolean,
  })
  async delete(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    await this.viewService.deleteView(body.id, userId)
    return { success: true }
  }

  @Post('clear')
  @ApiDoc({
    summary: '清空浏览记录',
    model: Boolean,
  })
  async clear(
    @Body() body: ClearUserViewDto,
    @CurrentUser('sub') userId: number,
  ) {
    await this.viewService.clearUserViews(userId, body.targetType)
    return { success: true }
  }
}

