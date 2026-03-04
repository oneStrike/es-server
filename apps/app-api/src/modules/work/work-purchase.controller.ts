import { WorkTypeEnum } from '@libs/base/constant'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { PurchaseService } from '@libs/interaction'
import {
  PaymentMethodEnum,
  PurchaseChapterDto,
  PurchasedWorkChapterItemDto,
  PurchasedWorkItemDto,
  PurchaseTargetTypeEnum,
QueryPurchasedWorkChapterDto,
QueryPurchasedWorkDto
} from '@libs/interaction/purchase'
import { Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags, OmitType } from '@nestjs/swagger'

class AppQueryPurchasedWorkDto extends OmitType(QueryPurchasedWorkDto, ['userId']) {}

class AppQueryPurchasedWorkChapterDto extends OmitType(
  QueryPurchasedWorkChapterDto,
  ['userId'],
) {}

@ApiTags('作品模块/购买')
@Controller('app/work/purchase')
export class WorkPurchaseController {
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
    @Query() query: PurchaseChapterDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.purchaseService.purchaseTarget({
      targetType:
        query.workType === WorkTypeEnum.COMIC
          ? PurchaseTargetTypeEnum.COMIC_CHAPTER
          : PurchaseTargetTypeEnum.NOVEL_CHAPTER,
      targetId: query.chapterId,
      userId,
      paymentMethod: PaymentMethodEnum.POINTS,
    })
  }
}
