import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import {
  BaseDto,
  IdDto,
  OMIT_BASE_FIELDS,
  PageDto,
  UserIdDto,
} from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from '../moderator.constant'

/**
 * 版主基础 DTO。
 * 严格对应 forum_moderator 表对外暴露的稳定字段。
 */
export class BaseForumModeratorDto extends IntersectionType(BaseDto, UserIdDto) {
  @NumberProperty({
    description: '分组ID（为空表示非分组版主）',
    example: 1,
    required: false,
    min: 1,
  })
  groupId?: number | null

  @EnumProperty({
    description: '版主角色类型（1=超级版主；2=分组版主；3=板块版主）',
    example: ForumModeratorRoleTypeEnum.SUPER,
    required: true,
    enum: ForumModeratorRoleTypeEnum,
  })
  roleType!: ForumModeratorRoleTypeEnum

  @ArrayProperty({
    description: '版主权限列表（1=置顶；2=加精；3=锁定；4=删除；5=审核；6=移动）',
    itemType: 'number',
    itemEnum: ForumModeratorPermissionEnum,
    example: [1, 2, 3, 4, 5, 6],
    required: false,
  })
  permissions?: ForumModeratorPermissionEnum[] | null

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '备注',
    example: '资深版主',
    required: false,
    maxLength: 500,
  })
  remark?: string | null

  @DateProperty({
    description: '删除时间；仅内部审计与排障使用。',
    example: '2026-03-19T12:00:00.000Z',
    required: false,
    contract: false,
  })
  deletedAt?: Date | null
}

export class ForumModeratorSectionIdsDto {
  @ArrayProperty({
    description: '板块ID列表；仅板块版主场景使用。',
    itemType: 'number',
    example: [1, 2, 3],
    required: true,
  })
  sectionIds!: number[]
}

export class CreateForumModeratorDto extends IntersectionType(
  OmitType(BaseForumModeratorDto, [...OMIT_BASE_FIELDS, 'deletedAt'] as const),
  PartialType(ForumModeratorSectionIdsDto),
) {}

export class UpdateForumModeratorDto extends IntersectionType(
  PartialType(OmitType(CreateForumModeratorDto, ['userId'] as const)),
  IdDto,
) {}

export class AssignForumModeratorSectionDto extends IntersectionType(
  ForumModeratorSectionIdsDto,
  PickType(BaseForumModeratorDto, ['permissions'] as const),
) {
  @NumberProperty({
    description: '版主ID',
    example: 1,
    required: true,
    min: 1,
  })
  moderatorId!: number
}

export class QueryForumModeratorDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumModeratorDto, ['isEnabled', 'userId'] as const),
  ),
) {
  @StringProperty({
    description: '用户昵称关键词',
    example: 'zhangsan',
    required: false,
  })
  nickname?: string

  @NumberProperty({
    description: '板块ID；用于筛出对该板块具有管理权限的版主。',
    example: 1,
    required: false,
    min: 1,
  })
  sectionId?: number
}

export class ForumModeratorGroupDto {
  @NumberProperty({
    description: '分组ID',
    example: 1,
    required: true,
    min: 1,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '分组名称',
    example: '技术交流',
    required: true,
    validation: false,
  })
  name!: string
}

export class ForumModeratorSectionItemDto {
  @NumberProperty({
    description: '板块ID',
    example: 1,
    required: true,
    min: 1,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '板块名称',
    example: 'TypeScript',
    required: true,
    validation: false,
  })
  name!: string

  @BooleanProperty({
    description: '是否继承基础权限',
    example: true,
    required: true,
    validation: false,
  })
  inheritFromParent!: boolean

  @ArrayProperty({
    description: '板块自定义权限（1=置顶；2=加精；3=锁定；4=删除；5=审核；6=移动）',
    itemType: 'number',
    itemEnum: ForumModeratorPermissionEnum,
    example: [1, 2],
    required: true,
    validation: false,
  })
  customPermissions!: ForumModeratorPermissionEnum[]

  @ArrayProperty({
    description: '板块最终生效权限（1=置顶；2=加精；3=锁定；4=删除；5=审核；6=移动）',
    itemType: 'number',
    itemEnum: ForumModeratorPermissionEnum,
    example: [1, 2, 3, 4],
    required: true,
    validation: false,
  })
  finalPermissions!: ForumModeratorPermissionEnum[]
}

export class ForumModeratorDto extends BaseForumModeratorDto {
  @ArrayProperty({
    description: '权限列表（1=置顶；2=加精；3=锁定；4=删除；5=审核；6=移动）',
    itemType: 'number',
    itemEnum: ForumModeratorPermissionEnum,
    example: [1, 2, 3, 4, 5, 6],
    required: true,
    validation: false,
  })
  declare permissions: ForumModeratorPermissionEnum[]

  @StringProperty({
    description: '用户昵称',
    example: '张三',
    required: true,
    validation: false,
  })
  nickname!: string

  @StringProperty({
    description: '用户头像',
    example: 'https://example.com/avatar.jpg',
    required: false,
    validation: false,
  })
  avatar?: string

  @NestedProperty({
    description: '所属分组',
    required: false,
    type: ForumModeratorGroupDto,
    validation: false,
  })
  group?: ForumModeratorGroupDto

  @ArrayProperty({
    description: '权限中文名称列表',
    itemType: 'string',
    example: ['置顶', '加精', '锁定', '删除', '审核', '移动'],
    required: true,
    validation: false,
  })
  permissionNames!: string[]

  @ArrayProperty({
    description: '管理的板块列表',
    itemClass: ForumModeratorSectionItemDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  sections!: ForumModeratorSectionItemDto[]
}
