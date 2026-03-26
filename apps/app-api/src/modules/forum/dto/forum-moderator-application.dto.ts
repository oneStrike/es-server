import { BaseForumModeratorApplicationDto } from '@libs/forum/moderator-application'
import { BaseForumSectionDto } from '@libs/forum/section'
import {
  ArrayProperty,
  NestedProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { BaseAppUserDto } from '@libs/user/core'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateForumModeratorApplicationDto extends PickType(
  BaseForumModeratorApplicationDto,
  ['sectionId', 'permissions', 'reason', 'remark'] as const,
) {}

export class QueryForumModeratorApplicationDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumModeratorApplicationDto, [
      'applicantId',
      'sectionId',
      'status',
    ] as const),
  ),
) {
  @StringProperty({
    description: '申请人昵称',
    example: '张三',
    required: false,
  })
  nickname?: string
}

class ForumModeratorApplicationUserDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

class ForumModeratorApplicationSectionDto extends PickType(BaseForumSectionDto, [
  'id',
  'name',
  'description',
  'icon',
  'cover',
] as const) {}

export class ForumModeratorApplicationDto extends BaseForumModeratorApplicationDto {
  @ArrayProperty({
    description: '权限名称列表',
    itemType: 'string',
    example: ['置顶', '加精', '审核'],
    required: true,
    validation: false,
  })
  permissionNames!: string[]

  @NestedProperty({
    description: '申请人信息',
    required: false,
    type: ForumModeratorApplicationUserDto,
    validation: false,
  })
  applicant?: ForumModeratorApplicationUserDto

  @NestedProperty({
    description: '审核人信息',
    required: false,
    type: ForumModeratorApplicationUserDto,
    validation: false,
  })
  auditor?: ForumModeratorApplicationUserDto

  @NestedProperty({
    description: '板块信息',
    required: false,
    type: ForumModeratorApplicationSectionDto,
    validation: false,
  })
  section?: ForumModeratorApplicationSectionDto
}
