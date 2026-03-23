import {
  BaseForumModeratorDto,
  ForumModeratorPermissionEnum,
} from '@libs/forum/moderator'
import {
  ArrayProperty,
  BooleanProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateForumModeratorDto extends OmitType(BaseForumModeratorDto, [
  ...OMIT_BASE_FIELDS,
  'deletedAt',
] as const) {
  @ArrayProperty({
    description: '板块ID列表（板块版主时必填）',
    itemType: 'number',
    example: [1, 2, 3],
    required: false,
  })
  sectionIds?: number[]
}

export class UpdateForumModeratorDto extends IntersectionType(
  PartialType(OmitType(CreateForumModeratorDto, ['userId'] as const)),
  IdDto,
) {}

export class AssignForumModeratorSectionDto {
  @NumberProperty({
    description: '版主ID',
    example: 1,
    required: true,
    min: 1,
  })
  moderatorId!: number

  @ArrayProperty({
    description: '板块ID列表',
    itemType: 'number',
    example: [1, 2, 3],
    required: true,
  })
  sectionIds!: number[]

  @ArrayProperty({
    description: '板块自定义权限列表，未传则沿用版主基础权限',
    itemType: 'number',
    example: [1, 2, 3],
    required: false,
  })
  permissions?: ForumModeratorPermissionEnum[]
}

export class QueryForumModeratorDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumModeratorDto, ['isEnabled', 'userId'] as const),
  ),
) {
  @StringProperty({
    description: '用户名',
    example: 'zhangsan',
    required: false,
  })
  nickname?: string

  @NumberProperty({
    description: '板块ID',
    example: 1,
    required: false,
    min: 1,
  })
  sectionId?: number
}

class ForumModeratorGroupDto {
  @NumberProperty({
    description: '分组ID',
    example: 1,
    required: true,
    min: 1,
  })
  id!: number

  @StringProperty({
    description: '分组名称',
    example: '技术交流',
    required: true,
  })
  name!: string
}

class ForumModeratorSectionItemDto {
  @NumberProperty({
    description: '板块ID',
    example: 1,
    required: true,
    min: 1,
  })
  id!: number

  @StringProperty({
    description: '板块名称',
    example: 'TypeScript',
    required: true,
  })
  name!: string

  @BooleanProperty({
    description: '是否继承基础权限',
    example: true,
    required: true,
  })
  inheritFromParent!: boolean

  @ArrayProperty({
    description: '板块自定义权限',
    itemType: 'number',
    example: [1, 2],
    required: true,
  })
  customPermissions!: ForumModeratorPermissionEnum[]

  @ArrayProperty({
    description: '板块最终生效权限',
    itemType: 'number',
    example: [1, 2, 3, 4],
    required: true,
  })
  finalPermissions!: ForumModeratorPermissionEnum[]
}

export class ForumModeratorDto extends BaseForumModeratorDto {
  @ArrayProperty({
    description: '权限列表',
    itemType: 'number',
    example: [1, 2, 3, 4, 5, 6],
    required: true,
  })
  declare permissions: ForumModeratorPermissionEnum[]

  @StringProperty({
    description: '昵称',
    example: '张三',
    required: true,
  })
  nickname!: string

  @StringProperty({
    description: '头像',
    example: 'https://example.com/avatar.jpg',
    required: false,
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
    description: '权限名称列表',
    itemType: 'string',
    example: ['置顶', '加精', '锁定', '删除', '审核', '移动'],
    required: true,
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
