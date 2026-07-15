import { BaseWorkChapterDto } from '@libs/content/work/chapter/dto/work-chapter.dto'
import { BaseWorkDto } from '@libs/content/work/core/dto/work.dto'
import { PurchaseRecordResponseDto } from '@libs/interaction/purchase/dto/purchase.dto'
import {
  DateProperty,
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { IntersectionType, PickType } from '@nestjs/swagger'
import { ContentPurchasePricingFieldsDto } from './content-purchase-pricing.dto'

/** 已购作品的稳定展示字段。 */
export class PurchasedWorkInfoDto extends PickType(BaseWorkDto, [
  'id',
  'type',
  'name',
  'cover',
] as const) {}

/** 已购作品分页项。 */
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

/** 已购章节的稳定展示字段。 */
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
] as const) {}

/** 已购章节分页项。 */
export class PurchasedWorkChapterItemDto extends IntersectionType(
  PurchaseRecordResponseDto,
  ContentPurchasePricingFieldsDto,
) {
  @NestedProperty({
    description: '章节信息',
    type: PurchasedChapterInfoDto,
    required: true,
    validation: false,
    nullable: false,
  })
  chapter!: PurchasedChapterInfoDto
}

/** 章节购买成功后的稳定响应模型。 */
export class PurchaseChapterResultDto extends IntersectionType(
  PurchaseRecordResponseDto,
  ContentPurchasePricingFieldsDto,
) {}
