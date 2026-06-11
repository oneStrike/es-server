import { BaseForumSectionDto } from '@libs/forum/section/dto/forum-section.dto'
import {
  ArrayProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto, IdDto } from '@libs/platform/dto/base.dto'
import { CursorPageSizeDto, PageDto } from '@libs/platform/dto/page.dto'

import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { ForumModeratorApplicationStatusEnum } from '../moderator-application.constant'
import { ForumModeratorPermissionEnum } from '../moderator.constant'

/**
 * 版主申请基础 DTO。
 * 严格对应 forum_moderator_application 表对外暴露的稳定字段。
 */
export class BaseForumModeratorApplicationDto extends BaseDto {
  @NumberProperty({
    description: '申请人用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  applicantId!: number

  @NumberProperty({
    description: '申请板块ID',
    example: 1,
    required: true,
    min: 1,
  })
  sectionId!: number

  @NumberProperty({
    description: '审核人ID',
    example: 2,
    required: true,
    nullable: true,
    min: 1,
    validation: false,
  })
  auditById!: number | null

  @EnumProperty({
    description: '申请状态（0=待审核；1=已通过；2=已拒绝）',
    example: ForumModeratorApplicationStatusEnum.PENDING,
    enum: ForumModeratorApplicationStatusEnum,
    required: true,
  })
  status!: ForumModeratorApplicationStatusEnum

  @ArrayProperty({
    description:
      '申请权限列表（1=置顶；2=加精；3=锁定；4=删除；5=审核；6=移动）',
    itemEnum: ForumModeratorPermissionEnum,
    example: [1, 2, 5],
    required: true,
  })
  permissions!: ForumModeratorPermissionEnum[]

  @StringProperty({
    description: '申请理由',
    example: '我长期活跃于该板块，愿意参与维护秩序',
    required: true,
    maxLength: 500,
  })
  reason!: string

  @StringProperty({
    description: '审核意见',
    example: '符合要求，予以通过',
    required: true,
    nullable: true,
    maxLength: 500,
  })
  auditReason!: string | null

  @StringProperty({
    description: '备注',
    example: '补充说明',
    required: true,
    nullable: true,
    maxLength: 500,
  })
  remark!: string | null

  @DateProperty({
    description: '审核时间',
    example: '2026-03-19T12:00:00.000Z',
    required: true,
    nullable: true,
    validation: false,
  })
  auditAt!: Date | null

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

class CreateForumModeratorApplicationRequiredFieldsDto extends PickType(
  BaseForumModeratorApplicationDto,
  ['sectionId', 'permissions', 'reason'] as const,
) {}

class CreateForumModeratorApplicationOptionalFieldsDto extends PartialType(
  PickType(BaseForumModeratorApplicationDto, ['remark'] as const),
) {}

export class CreateForumModeratorApplicationDto extends IntersectionType(
  CreateForumModeratorApplicationRequiredFieldsDto,
  CreateForumModeratorApplicationOptionalFieldsDto,
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
    description: '申请人昵称关键词',
    example: '张三',
    required: false,
  })
  nickname?: string
}

export class QueryMyForumModeratorApplicationDto extends IntersectionType(
  CursorPageSizeDto,
  PartialType(
    PickType(BaseForumModeratorApplicationDto, ['sectionId', 'status'] as const),
  ),
) {
  @StringProperty({
    description: '下一页游标；提供后按申请时间倒序游标翻页',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTAxVDAwOjAwOjAwLjAwMFoiLCJpZCI6MTAwfQ',
    required: false,
  })
  cursor?: string
}

export class AuditForumModeratorApplicationDto extends IntersectionType(
  IdDto,
  IntersectionType(
    PickType(BaseForumModeratorApplicationDto, ['status'] as const),
    PartialType(
      PickType(BaseForumModeratorApplicationDto, [
        'auditReason',
        'remark',
      ] as const),
    ),
  ),
) {}

class ForumModeratorApplicationUserDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

class ForumModeratorApplicationSectionDto extends PickType(
  BaseForumSectionDto,
  ['id', 'name', 'description', 'icon', 'cover'] as const,
) {}

export class ForumModeratorApplicationDto extends OmitType(
  BaseForumModeratorApplicationDto,
  ['deletedAt'] as const,
) {
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
    required: true,
    type: ForumModeratorApplicationUserDto,
    validation: false,
    nullable: false,
  })
  applicant!: ForumModeratorApplicationUserDto

  @NestedProperty({
    description: '审核人信息',
    required: true,
    nullable: true,
    type: ForumModeratorApplicationUserDto,
    validation: false,
  })
  auditor!: ForumModeratorApplicationUserDto | null

  @NestedProperty({
    description: '板块信息',
    required: true,
    type: ForumModeratorApplicationSectionDto,
    validation: false,
    nullable: false,
  })
  section!: ForumModeratorApplicationSectionDto
}
