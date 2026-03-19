import {
  BaseUserBadgeDto,
  BaseUserExperienceRecordDto,
  BaseUserPointRecordDto,
  GrowthRuleTypeEnum,
} from '@libs/growth'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'
import { BaseAppUserDto } from '@libs/user'

import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class BaseAdminAppUserDto extends BaseAppUserDto {}

export class AdminAppUserLevelDto {
  @NumberProperty({
    description: '等级ID',
    example: 1,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '等级名称',
    example: '新手',
    validation: false,
  })
  name!: string

  @NumberProperty({
    description: '升级所需经验值',
    example: 100,
    validation: false,
  })
  requiredExperience!: number
}

export class AdminAppUserForumProfileDto {
  @StringProperty({
    description: '论坛签名',
    example: '持续交付，持续迭代',
    required: false,
    validation: false,
  })
  signature?: string

  @StringProperty({
    description: '论坛简介',
    example: '一个简单的自我介绍',
    required: false,
    validation: false,
  })
  bio?: string

  @NumberProperty({
    description: '主题数',
    example: 12,
    validation: false,
  })
  topicCount!: number

  @NumberProperty({
    description: '回复数',
    example: 48,
    validation: false,
  })
  replyCount!: number

  @NumberProperty({
    description: '获赞数',
    example: 66,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '获收藏数',
    example: 9,
    validation: false,
  })
  favoriteCount!: number
}

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
  })
  level?: AdminAppUserLevelDto

  @NestedProperty({
    description: '下一等级信息',
    type: AdminAppUserLevelDto,
    required: false,
    validation: false,
  })
  nextLevel?: AdminAppUserLevelDto

  @NumberProperty({
    description: '距离下一等级的经验差值',
    example: 50,
    required: false,
    validation: false,
  })
  gapToNextLevel?: number
}

export class AdminAppUserPageItemDto extends BaseAdminAppUserDto {
  @StringProperty({
    description: '等级名称',
    example: '新手',
    required: false,
    validation: false,
  })
  levelName?: string

  @NumberProperty({
    description: '主题数',
    example: 12,
    validation: false,
  })
  topicCount!: number

  @NumberProperty({
    description: '回复数',
    example: 48,
    validation: false,
  })
  replyCount!: number
}

export class AdminAppUserDetailDto extends BaseAdminAppUserDto {
  @NestedProperty({
    description: '等级信息',
    type: AdminAppUserLevelDto,
    required: false,
    validation: false,
  })
  level?: AdminAppUserLevelDto

  @NestedProperty({
    description: '论坛画像信息',
    type: AdminAppUserForumProfileDto,
    required: false,
    validation: false,
  })
  forumProfile?: AdminAppUserForumProfileDto

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
  })
  pointStats!: AdminAppUserPointStatsDto

  @NestedProperty({
    description: '经验统计',
    type: AdminAppUserExperienceStatsDto,
    validation: false,
  })
  experienceStats!: AdminAppUserExperienceStatsDto
}

export class QueryAdminAppUserPageDto extends IntersectionType(
  PartialType(
    PickType(BaseAdminAppUserDto, [
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

export class QueryAdminAppUserIdDto {
  @NumberProperty({
    description: '应用端用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class UpdateAdminAppUserProfileDto extends IntersectionType(
  PickType(BaseAdminAppUserDto, ['id'] as const),
  PartialType(
    PickType(BaseAdminAppUserDto, [
      'nickname',
      'avatarUrl',
      'phoneNumber',
      'emailAddress',
      'genderType',
      'birthDate',
    ] as const),
  ),
) {
  @StringProperty({
    description: '论坛签名',
    example: '持续交付，持续迭代',
    required: false,
    maxLength: 200,
  })
  signature?: string

  @StringProperty({
    description: '论坛简介',
    example: '一个简单的自我介绍',
    required: false,
    maxLength: 500,
  })
  bio?: string
}

export class UpdateAdminAppUserEnabledDto extends PickType(BaseAdminAppUserDto, [
  'id',
  'isEnabled',
] as const) {}

export class UpdateAdminAppUserStatusDto extends PickType(BaseAdminAppUserDto, [
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

export class AdminAppUserPointRecordDto extends PickType(BaseUserPointRecordDto, [
  'id',
  'userId',
  'ruleId',
  'targetType',
  'targetId',
  'remark',
  'createdAt',
] as const) {
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
  PageDto,
  PartialType(
    PickType(
      BaseUserPointRecordDto,
      ['ruleId', 'targetType', 'targetId'] as const,
    ),
  ),
) {
  @NumberProperty({
    description: '应用端用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

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
  PageDto,
  PartialType(PickType(BaseUserExperienceRecordDto, ['ruleId'] as const)),
) {
  @NumberProperty({
    description: '应用端用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class QueryAdminAppUserBadgeDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(
      BaseUserBadgeDto,
      ['name', 'type', 'isEnabled', 'business', 'eventKey'] as const,
    ),
  ),
) {
  @NumberProperty({
    description: '应用端用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class AddAdminAppUserPointsDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

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

export class ConsumeAdminAppUserPointsDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

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

export class AddAdminAppUserExperienceDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

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

export class AssignAdminAppUserBadgeDto {
  @NumberProperty({
    description: '应用端用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  badgeId!: number
}

export class AdminAppUserBadgeItemDto extends PickType(BaseDto, ['id', 'createdAt']) {
  @NestedProperty({
    description: '徽章信息',
    type: BaseUserBadgeDto,
    validation: false,
  })
  badge!: BaseUserBadgeDto
}

export class AdminAppUserBadgeOperationResultDto {
  @NumberProperty({
    description: '应用端用户ID',
    example: 1,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '徽章ID',
    example: 1,
    validation: false,
  })
  badgeId!: number
}
