import { BaseForumModeratorApplicationDto } from '@libs/forum/moderator-application'
import { BaseForumSectionDto } from '@libs/forum/section'
import {
  ArrayProperty,
  NestedProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { BaseAppUserDto } from '@libs/user/core'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

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

export class AuditForumModeratorApplicationDto extends IntersectionType(
  IdDto,
  PickType(BaseForumModeratorApplicationDto, ['status'] as const),
) {
  @StringProperty({
    description: '审核意见',
    example: '审核通过',
    required: false,
    maxLength: 500,
  })
  auditReason?: string

  @StringProperty({
    description: '备注',
    example: '安排试用期观察',
    required: false,
    maxLength: 500,
  })
  remark?: string
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
    nullable: false,
  })
  applicant!: ForumModeratorApplicationUserDto

  @NestedProperty({
    description: '审核人信息',
    required: false,
    type: ForumModeratorApplicationUserDto,
    validation: false,
    nullable: false,
  })
  auditor!: ForumModeratorApplicationUserDto

  @NestedProperty({
    description: '板块信息',
    required: false,
    type: ForumModeratorApplicationSectionDto,
    validation: false,
    nullable: false,
  })
  section!: ForumModeratorApplicationSectionDto
}
