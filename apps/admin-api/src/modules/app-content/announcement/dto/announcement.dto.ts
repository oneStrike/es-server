import {
  BaseAnnouncementDto,
  BaseAppPageDto,
} from '@libs/app-content'
import {
  JsonProperty,
  NestedProperty,
} from '@libs/platform/decorators'
import {
  IdDto,
  OMIT_BASE_FIELDS,
  PageDto,
} from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class RelatedPageDto extends PickType(BaseAppPageDto, [
  'id',
  'name',
  'code',
  'path',
] as const) {}

export class AnnouncementDetailDto extends BaseAnnouncementDto {
  @NestedProperty({
    description: '公告关联页面',
    required: true,
    type: RelatedPageDto,
    validation: false,
  })
  appPage!: RelatedPageDto
}

export class CreateAnnouncementDto extends OmitType(BaseAnnouncementDto, [
  ...OMIT_BASE_FIELDS,
  'isPublished',
  'viewCount',
] as const) {}

export class UpdateAnnouncementDto extends IntersectionType(
  CreateAnnouncementDto,
  IdDto,
) {}

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

export class UpdateAnnouncementStatusDto extends IntersectionType(
  PickType(BaseAnnouncementDto, ['isPublished'] as const),
  IdDto,
) {}

export class AnnouncementPageResponseDto extends OmitType(BaseAnnouncementDto, [
  'content',
  'popupBackgroundImage',
] as const) {}
