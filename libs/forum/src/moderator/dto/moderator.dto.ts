import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import {
  BaseDto,
  UserIdDto,
} from '@libs/platform/dto'
import { IntersectionType } from '@nestjs/swagger'
import {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from '../moderator.constant'

/**
 * 版主基础 DTO。
 * 严格对应 forum_moderator 表字段。
 */
export class BaseForumModeratorDto extends IntersectionType(
  BaseDto,
  UserIdDto,
) {
  @NumberProperty({
    description: '分组ID（分组版主时使用）',
    example: 1,
    required: false,
    min: 1,
  })
  groupId?: number

  @EnumProperty({
    description: '版主角色类型',
    example: ForumModeratorRoleTypeEnum.SUPER,
    required: true,
    enum: ForumModeratorRoleTypeEnum,
  })
  roleType!: ForumModeratorRoleTypeEnum

  @ArrayProperty({
    description: '权限列表',
    itemType: 'number',
    example: [1, 2, 3, 4, 5, 6],
    required: false,
  })
  permissions?: ForumModeratorPermissionEnum[]

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '备注',
    example: '资深版主',
    required: false,
    maxLength: 500,
  })
  remark?: string

  @DateProperty({
    description: '删除时间',
    example: '2026-03-19T12:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}
