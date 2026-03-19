import type { ForumModeratorPermissionEnum } from '../../moderator'
import {
  ArrayProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { ForumModeratorApplicationStatusEnum } from '../moderator-application.constant'

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
    required: false,
    min: 1,
  })
  auditById?: number | null

  @EnumProperty({
    description: '申请状态',
    example: ForumModeratorApplicationStatusEnum.PENDING,
    enum: ForumModeratorApplicationStatusEnum,
    required: true,
  })
  status!: ForumModeratorApplicationStatusEnum

  @ArrayProperty({
    description: '申请权限列表',
    itemType: 'number',
    example: [1, 2, 5],
    required: false,
  })
  permissions?: ForumModeratorPermissionEnum[]

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
    required: false,
    maxLength: 500,
  })
  auditReason?: string | null

  @StringProperty({
    description: '备注',
    example: '补充说明',
    required: false,
    maxLength: 500,
  })
  remark?: string | null

  @DateProperty({
    description: '审核时间',
    example: '2026-03-19T12:00:00.000Z',
    required: false,
  })
  auditAt?: Date | null

  @DateProperty({
    description: '删除时间',
    example: '2026-03-19T12:00:00.000Z',
    required: false,
  })
  deletedAt?: Date | null
}
