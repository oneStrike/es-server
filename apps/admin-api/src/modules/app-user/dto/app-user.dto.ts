import { BaseUserBadgeDto } from '@libs/growth/badge'
import { BaseUserExperienceRecordDto } from '@libs/growth/experience'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule'
import { BaseUserPointRecordDto } from '@libs/growth/point'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto, UserIdDto } from '@libs/platform/dto'
import { BaseAppUserCountDto, BaseAppUserDto } from '@libs/user/core'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

export enum AdminAppUserDeletedScopeEnum {
  ACTIVE = 'active',
  DELETED = 'deleted',
  ALL = 'all',
}

export class AdminAppUserLevelDto extends PickType(BaseUserLevelRuleDto, [
  'id',
  'name',
  'requiredExperience',
] as const) {}

export class AdminAppUserCountDto extends PickType(BaseAppUserCountDto, [
  'commentCount',
  'likeCount',
  'favoriteCount',
  'followingCount',
  'followersCount',
  'forumTopicCount',
  'commentReceivedLikeCount',
  'forumTopicReceivedLikeCount',
  'forumTopicReceivedFavoriteCount',
] as const) {}

export class AdminAppUserPointStatsDto {
  @NumberProperty({
    description: '当前积分',
    example: 120,
    validation: false,
  })
  currentPoints!: number

  @NumberProperty({
    description: '今日获得积分',
    example: 15,
    validation: false,
  })
  todayEarned!: number

  @NumberProperty({
    description: '今日消耗积分',
    example: 5,
    validation: false,
  })
  todayConsumed!: number
}

export class AdminAppUserExperienceStatsDto {
  @NumberProperty({
    description: '当前经验值',
    example: 350,
    validation: false,
  })
  currentExperience!: number

  @NumberProperty({
    description: '今日获得经验值',
    example: 20,
    validation: false,
  })
  todayEarned!: number

  @NestedProperty({
    description: '当前等级信息',
    type: AdminAppUserLevelDto,
    required: false,
    validation: false,
    nullable: false,
  })
  level!: AdminAppUserLevelDto

  @NestedProperty({
    description: '下一等级信息',
    type: AdminAppUserLevelDto,
    required: false,
    validation: false,
    nullable: false,
  })
  nextLevel!: AdminAppUserLevelDto

  @NumberProperty({
    description: '距离下一等级的经验差值',
    example: 50,
    required: false,
    validation: false,
  })
  gapToNextLevel?: number
}

export class AdminAppUserPageItemDto extends BaseAppUserDto {
  @StringProperty({
    description: '等级名称',
    example: '新手',
    required: false,
    validation: false,
  })
  levelName?: string

  @NestedProperty({
    description: '用户计数',
    type: AdminAppUserCountDto,
    validation: false,
    nullable: false,
  })
  counts!: AdminAppUserCountDto
}

export class AdminAppUserDetailDto extends BaseAppUserDto {
  @NestedProperty({
    description: '等级信息',
    type: AdminAppUserLevelDto,
    required: false,
    validation: false,
    nullable: false,
  })
  level!: AdminAppUserLevelDto

  @NestedProperty({
    description: '用户计数',
    type: AdminAppUserCountDto,
    required: false,
    validation: false,
    nullable: false,
  })
  counts!: AdminAppUserCountDto

  @NumberProperty({
    description: '已拥有徽章数量',
    example: 3,
    validation: false,
  })
  badgeCount!: number

  @NestedProperty({
    description: '积分统计',
    type: AdminAppUserPointStatsDto,
    validation: false,
    nullable: false,
  })
  pointStats!: AdminAppUserPointStatsDto

  @NestedProperty({
    description: '经验统计',
    type: AdminAppUserExperienceStatsDto,
    validation: false,
    nullable: false,
  })
  experienceStats!: AdminAppUserExperienceStatsDto
}

export class QueryAdminAppUserPageDto extends IntersectionType(
  PartialType(
    PickType(BaseAppUserDto, [
      'id',
      'account',
      'phoneNumber',
      'nickname',
      'emailAddress',
      'isEnabled',
      'status',
      'levelId',
    ] as const),
  ),
  PageDto,
) {
  @EnumProperty({
    description: '删除态筛选（active=未删除，deleted=已删除，all=全部）',
    enum: AdminAppUserDeletedScopeEnum,
    example: AdminAppUserDeletedScopeEnum.ACTIVE,
    required: false,
    default: AdminAppUserDeletedScopeEnum.ACTIVE,
  })
  deletedScope?: AdminAppUserDeletedScopeEnum

  @StringProperty({
    description: '最后登录开始时间',
    example: '2026-03-01',
    required: false,
    type: 'ISO8601',
  })
  lastLoginStartDate?: string

  @StringProperty({
    description: '最后登录结束时间',
    example: '2026-03-08',
    required: false,
    type: 'ISO8601',
  })
  lastLoginEndDate?: string
}

export class AdminAppUserFollowCountRepairResultDto extends IntersectionType(
  UserIdDto,
  PickType(AdminAppUserCountDto, ['followingCount', 'followersCount'] as const),
) {}

export class CreateAdminAppUserDto extends IntersectionType(
  PickType(BaseAppUserDto, ['nickname'] as const),
  PartialType(
    PickType(BaseAppUserDto, [
      'phoneNumber',
      'emailAddress',
      'avatarUrl',
      'genderType',
      'birthDate',
      'isEnabled',
      'status',
      'signature',
      'bio',
    ] as const),
  ),
) {
  @StringProperty({
    description: '前端 RSA 加密后的密码',
    example: 'Base64EncodedCipherText',
    required: true,
    maxLength: 2000,
  })
  password!: string
}

export class ResetAdminAppUserPasswordDto extends PickType(BaseAppUserDto, [
  'id',
] as const) {
  @StringProperty({
    description: '前端 RSA 加密后的新密码',
    example: 'Base64EncodedCipherText',
    required: true,
    maxLength: 2000,
  })
  password!: string
}

export class UpdateAdminAppUserProfileDto extends IntersectionType(
  PickType(BaseAppUserDto, ['id'] as const),
  PartialType(
    PickType(BaseAppUserDto, [
      'nickname',
      'avatarUrl',
      'phoneNumber',
      'emailAddress',
      'genderType',
      'birthDate',
      'signature',
      'bio',
    ] as const),
  ),
) {}

export class UpdateAdminAppUserEnabledDto extends PickType(BaseAppUserDto, [
  'id',
  'isEnabled',
] as const) {}

export class UpdateAdminAppUserStatusDto extends PickType(BaseAppUserDto, [
  'id',
  'status',
] as const) {
  @StringProperty({
    description: '封禁或禁言原因',
    example: '违反社区规范',
    required: false,
    maxLength: 500,
  })
  banReason?: string

  @DateProperty({
    description: '封禁或禁言截止时间',
    example: '2026-03-08T10:00:00.000Z',
    required: false,
  })
  banUntil?: Date
}

export class AdminAppUserPointRecordDto extends PickType(
  BaseUserPointRecordDto,
  [
    'id',
    'userId',
    'ruleId',
    'targetType',
    'targetId',
    'remark',
    'createdAt',
  ] as const,
) {
  @NumberProperty({
    description: '积分变化（正数为获得，负数为消费）',
    example: 5,
    validation: false,
  })
  points!: number

  @NumberProperty({
    description: '变化前积分',
    example: 100,
    validation: false,
  })
  beforePoints!: number

  @NumberProperty({
    description: '变化后积分',
    example: 105,
    validation: false,
  })
  afterPoints!: number
}

export class QueryAdminAppUserPointRecordDto extends IntersectionType(
  UserIdDto,
  IntersectionType(
    PageDto,
    PartialType(
      PickType(BaseUserPointRecordDto, [
        'ruleId',
        'targetType',
        'targetId',
      ] as const),
    ),
  ),
) {}

export class AdminAppUserExperienceRecordDto extends PickType(
  BaseUserExperienceRecordDto,
  ['id', 'userId', 'ruleId', 'remark', 'createdAt'] as const,
) {
  @NumberProperty({
    description: '经验值变化',
    example: 5,
    validation: false,
  })
  experience!: number

  @NumberProperty({
    description: '变化前经验值',
    example: 100,
    validation: false,
  })
  beforeExperience!: number

  @NumberProperty({
    description: '变化后经验值',
    example: 105,
    validation: false,
  })
  afterExperience!: number
}

export class QueryAdminAppUserExperienceRecordDto extends IntersectionType(
  UserIdDto,
  IntersectionType(
    PageDto,
    PartialType(PickType(BaseUserExperienceRecordDto, ['ruleId'] as const)),
  ),
) {}

export class QueryAdminAppUserBadgeDto extends IntersectionType(
  UserIdDto,
  IntersectionType(
    PageDto,
    PartialType(
      PickType(BaseUserBadgeDto, [
        'name',
        'type',
        'isEnabled',
        'business',
        'eventKey',
      ] as const),
    ),
  ),
) {}

export class AddAdminAppUserPointsDto extends UserIdDto {
  @EnumProperty({
    description:
      '规则类型（论坛：1=发表主题，2=发表回复，3=主题被点赞，4=回复被点赞，5=主题被收藏，6=每日签到，7=管理员操作，8=主题浏览，9=主题举报，10=发表评论，11=评论被点赞，12=评论被举报，16=主题被评论；漫画作品：100=浏览，101=点赞，102=收藏，103=举报，104=评论；小说作品：200=浏览，201=点赞，202=收藏，203=举报，204=评论；漫画章节：300=阅读，301=点赞，302=购买，303=下载，304=兑换，305=举报，306=评论；小说章节：400=阅读，401=点赞，402=购买，403=下载，404=兑换，405=举报，406=评论；徽章与成就：600=获得徽章，601=完善资料，602=上传头像；社交：700=关注用户，701=被关注，702=分享内容，703=邀请用户；举报处理：800=举报有效，801=举报无效）',
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    enum: GrowthRuleTypeEnum,
  })
  ruleType!: GrowthRuleTypeEnum

  @StringProperty({
    description: '备注',
    example: '管理员发放积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class ConsumeAdminAppUserPointsDto extends UserIdDto {
  @NumberProperty({
    description: '消费积分数量',
    example: 10,
    required: true,
  })
  points!: number

  @NumberProperty({
    description: '关联目标类型',
    example: 3,
    required: false,
  })
  targetType?: number

  @NumberProperty({
    description: '关联目标ID',
    example: 1,
    required: false,
  })
  targetId?: number

  @NumberProperty({
    description: '关联兑换ID',
    example: 1,
    required: false,
  })
  exchangeId?: number

  @StringProperty({
    description: '备注',
    example: '管理员扣减积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class AddAdminAppUserExperienceDto extends UserIdDto {
  @EnumProperty({
    description:
      '规则类型（论坛：1=发表主题，2=发表回复，3=主题被点赞，4=回复被点赞，5=主题被收藏，6=每日签到，7=管理员操作，8=主题浏览，9=主题举报，10=发表评论，11=评论被点赞，12=评论被举报，16=主题被评论；漫画作品：100=浏览，101=点赞，102=收藏，103=举报，104=评论；小说作品：200=浏览，201=点赞，202=收藏，203=举报，204=评论；漫画章节：300=阅读，301=点赞，302=购买，303=下载，304=兑换，305=举报，306=评论；小说章节：400=阅读，401=点赞，402=购买，403=下载，404=兑换，405=举报，406=评论；徽章与成就：600=获得徽章，601=完善资料，602=上传头像；社交：700=关注用户，701=被关注，702=分享内容，703=邀请用户；举报处理：800=举报有效，801=举报无效）',
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    enum: GrowthRuleTypeEnum,
  })
  ruleType!: GrowthRuleTypeEnum

  @StringProperty({
    description: '备注',
    example: '管理员发放经验',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class AssignAdminAppUserBadgeDto extends UserIdDto {
  @NumberProperty({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  badgeId!: number
}

export class AdminAppUserBadgeItemDto extends PickType(BaseDto, [
  'createdAt',
] as const) {
  @NestedProperty({
    description: '徽章信息',
    type: BaseUserBadgeDto,
    validation: false,
    nullable: false,
  })
  badge!: BaseUserBadgeDto
}

export class AdminAppUserBadgeOperationResultDto extends UserIdDto {
  @NumberProperty({
    description: '徽章ID',
    example: 1,
    validation: false,
  })
  badgeId!: number
}
