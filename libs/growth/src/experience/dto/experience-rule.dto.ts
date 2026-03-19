import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class BaseUserExperienceRuleDto extends BaseDto {
  @EnumProperty({
    description:
      '规则类型（论坛：1=发表主题，2=发表回复，3=主题被点赞，4=回复被点赞，5=主题被收藏，6=每日签到，7=管理员操作，8=主题浏览，9=主题举报，10=发表评论，11=评论被点赞，12=评论被举报，16=主题被评论；漫画作品：100=浏览，101=点赞，102=收藏，103=举报，104=评论；小说作品：200=浏览，201=点赞，202=收藏，203=举报，204=评论；漫画章节：300=阅读，301=点赞，302=购买，303=下载，304=兑换，305=举报，306=评论；小说章节：400=阅读，401=点赞，402=购买，403=下载，404=兑换，405=举报，406=评论；徽章与成就：600=获得徽章，601=完善资料，602=上传头像；社交：700=关注用户，701=被关注，702=分享内容，703=邀请用户；举报处理：800=举报有效，801=举报无效）',
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    required: true,
    enum: GrowthRuleTypeEnum,
  })
  type!: GrowthRuleTypeEnum

  @NumberProperty({
    description: '经验值变化',
    example: 5,
    required: true,
  })
  experience!: number

  @NumberProperty({
    description: '每日上限（0=无限制）',
    example: 0,
    required: true,
    default: 0,
  })
  dailyLimit!: number

  @NumberProperty({
    description: '总上限（0=无限制）',
    example: 0,
    required: true,
    default: 0,
  })
  totalLimit!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '备注',
    example: '用户发表主题时获得经验',
    required: false,
    maxLength: 500,
  })
  remark?: string
}
