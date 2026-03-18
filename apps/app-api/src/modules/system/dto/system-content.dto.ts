import {
  BaseAgreementDto,
  BaseAnnouncementDto,
} from '@libs/app-content'
import { JsonProperty } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class QueryPublishedAgreementDto extends PickType(BaseAgreementDto, [
  'showInAuth',
] as const) {}

export class ListOrPageAgreementResponseDto extends PickType(BaseAgreementDto, [
  'content',
] as const) {}

export class QueryAnnouncementDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAnnouncementDto, [
      'title',
      'announcementType',
      'priorityLevel',
      'isPublished',
      'isPinned',
      'showAsPopup',
      'pageId',
      'publishStartTime',
      'publishEndTime',
    ] as const),
  ),
) {
  @JsonProperty({
    description: '启用平台筛选 JSON 字符串',
    example: '[1,2,3]',
    required: false,
  })
  enablePlatform?: string
}

export class AnnouncementPageResponseDto extends OmitType(BaseAnnouncementDto, [
  'content',
  'popupBackgroundImage',
] as const) {}
