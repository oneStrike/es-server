import {
  BaseWorkChapterDto,
  BaseWorkDto,
} from '@libs/content/work'
import { BasePurchaseRecordDto } from '@libs/interaction/purchase'
import { WorkTypeEnum } from '@libs/platform/constant'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class PurchaseTargetBodyDto extends PickType(BasePurchaseRecordDto, [
  'targetId',
  'targetType',
  'paymentMethod',
  'outTradeNo',
]) {}

export class QueryPurchasedWorkDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BasePurchaseRecordDto), ['targetType', 'status']),
) {
  @EnumProperty({
    description: '作品类型（1=漫画，2=小说）',
    enum: WorkTypeEnum,
    example: WorkTypeEnum.COMIC,
    required: false,
  })
  workType?: WorkTypeEnum
}

export class QueryPurchasedWorkChapterDto extends QueryPurchasedWorkDto {
  @NumberProperty({
    description: '作品 ID',
    example: 1,
    required: true,
  })
  workId!: number
}

export class PurchasedWorkInfoDto extends PickType(BaseWorkDto, [
  'id',
  'type',
  'name',
  'cover',
]) {}

export class PurchasedWorkItemDto {
  @NestedProperty({
    description: '作品信息',
    type: PurchasedWorkInfoDto,
    required: true,
    validation: false,
    nullable: false,
  })
  work!: PurchasedWorkInfoDto

  @NumberProperty({
    description: '已购章节数',
    example: 12,
    required: true,
    min: 0,
    validation: false,
  })
  purchasedChapterCount!: number

  @DateProperty({
    description: '最近购买时间',
    example: '2026-03-04T09:00:00.000Z',
    required: true,
    validation: false,
  })
  lastPurchasedAt!: Date
}

export class PurchasedChapterInfoDto extends PickType(BaseWorkChapterDto, [
  'id',
  'workId',
  'workType',
  'title',
  'subtitle',
  'cover',
  'sortOrder',
  'isPublished',
  'publishAt',
]) {}

export class PurchasedWorkChapterItemDto extends BasePurchaseRecordDto {
  @NestedProperty({
    description: '章节信息',
    type: PurchasedChapterInfoDto,
    required: true,
    validation: false,
    nullable: false,
  })
  chapter!: PurchasedChapterInfoDto
}
