import { GenderEnum, UserStatusEnum } from '@libs/platform/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'

/**
 * 应用用户全量基类 DTO
 * 100% 对齐 app_user 表定义
 */
export class BaseAppUserDto extends BaseDto {
  @StringProperty({
    description: '账号',
    example: 'user001',
    required: true,
    maxLength: 20,
  })
  account!: string

  @StringProperty({
    description: '手机号',
    example: '13800000000',
    required: false,
    maxLength: 20,
  })
  phoneNumber?: string | null

  @StringProperty({
    description: '邮箱',
    example: 'user@example.com',
    required: false,
    maxLength: 255,
  })
  emailAddress?: string | null

  @NumberProperty({
    description: '等级ID',
    example: 1,
    required: false,
  })
  levelId?: number | null

  @StringProperty({
    description: '昵称',
    example: '张三',
    required: true,
    maxLength: 100,
  })
  nickname!: string

  @StringProperty({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    maxLength: 500,
    password: true,
  })
  password!: string

  @StringProperty({
    description: '头像URL',
    example: 'https://example.com/avatar.png',
    required: false,
    maxLength: 500,
  })
  avatarUrl?: string | null

  @BooleanProperty({
    description: '是否启用',
    example: true,
    default: true,
    required: true,
  })
  isEnabled!: boolean

  @EnumProperty({
    description: '性别（0=未知，1=男，2=女，3=其他，4=保密）',
    enum: GenderEnum,
    example: GenderEnum.MALE,
    default: GenderEnum.UNKNOWN,
    required: true,
  })
  genderType!: GenderEnum

  @DateProperty({
    description: '出生日期',
    example: '2000-01-01',
    required: false,
  })
  birthDate?: string | Date | null

  @NumberProperty({
    description: '积分',
    example: 100,
    default: 0,
    required: true,
  })
  points!: number

  @NumberProperty({
    description: '经验值',
    example: 500,
    default: 0,
    required: true,
  })
  experience!: number

  @EnumProperty({
    description: '用户状态',
    enum: UserStatusEnum,
    example: UserStatusEnum.NORMAL,
    default: UserStatusEnum.NORMAL,
    required: true,
  })
  status!: UserStatusEnum

  @StringProperty({
    description: '封禁原因',
    example: '违规操作',
    required: false,
    maxLength: 500,
  })
  banReason?: string | null

  @DateProperty({
    description: '封禁到期时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  banUntil?: Date | null

  @DateProperty({
    description: '最后登录时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  lastLoginAt?: Date | null

  @StringProperty({
    description: '最后登录IP',
    example: '192.168.1.1',
    required: false,
    maxLength: 45,
  })
  lastLoginIp?: string | null

  @DateProperty({
    description: '删除时间（软删除）',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}
