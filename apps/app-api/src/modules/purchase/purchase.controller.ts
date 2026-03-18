import {
  PurchasedWorkChapterItemDto,
  PurchasedWorkItemDto,
  PurchaseService,
  PurchaseTargetBodyDto,
  QueryPurchasedWorkChapterDto,
  QueryPurchasedWorkDto,
} from '@libs/interaction'

import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags, OmitType } from '@nestjs/swagger'

class AppQueryPurchasedWorkDto extends OmitType(QueryPurchasedWorkDto, [
  'userId',
]) {}

class AppQueryPurchasedWorkChapterDto extends OmitType(
  QueryPurchasedWorkChapterDto,
  ['userId'],
) {}

@ApiTags('购买模块')
@Controller('app/purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get('works')
  @ApiPageDoc({
    summary: '分页查询已购作品',
    model: PurchasedWorkItemDto,
  })
  async getPurchasedWorks(
    @Query() query: AppQueryPurchasedWorkDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.purchaseService.getPurchasedWorks({
      ...query,
      userId,
    })
  }

  @Get('work-chapters')
  @ApiPageDoc({
    summary: '分页查询指定作品已购章节',
    model: PurchasedWorkChapterItemDto,
  })
  async getPurchasedWorkChapters(
    @Query() query: AppQueryPurchasedWorkChapterDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.purchaseService.getPurchasedWorkChapters({
      ...query,
      userId,
    })
  }

  @Post('chapter')
  @ApiDoc({
    summary: '购买章节（漫画/小说）',
    model: IdDto,
  })
  async purchaseChapter(
    @Body() body: PurchaseTargetBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.purchaseService.purchaseChapter({
      userId,
      ...body,
    })
  }
}
