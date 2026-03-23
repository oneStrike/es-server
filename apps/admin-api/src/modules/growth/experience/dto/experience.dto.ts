import {
  BaseUserExperienceRecordDto,
  BaseUserExperienceRuleDto,
} from '@libs/growth/experience'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import {
  EnumProperty,
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

export class CreateUserExperienceRuleDto extends OmitType(
  BaseUserExperienceRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateUserExperienceRuleDto extends IntersectionType(
  PartialType(CreateUserExperienceRuleDto),
  IdDto,
) {}

export class QueryUserExperienceRuleDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserExperienceRuleDto, ['type', 'isEnabled'] as const),
  ),
) {}

export class QueryUserExperienceRecordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseUserExperienceRecordDto, ['ruleId'] as const)),
) {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class AddUserExperienceDto {
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

export class UserExperienceRecordDto extends PickType(BaseUserExperienceRecordDto, [
  'id',
  'userId',
  'ruleId',
  'remark',
  'createdAt',
] as const) {
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
