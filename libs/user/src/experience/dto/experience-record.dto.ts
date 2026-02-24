import { NumberProperty, StringProperty } from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

export class BaseUserExperienceRecordDto extends BaseDto {
  @NumberProperty({
    description: '关联的用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '关联的规则ID',
    example: 1,
    required: false,
  })
  ruleId?: number

  @NumberProperty({
    description: '经验值变化',
    example: 5,
    required: true,
  })
  experience!: number

  @NumberProperty({
    description: '变化前经验值',
    example: 100,
    required: true,
  })
  beforeExperience!: number

  @NumberProperty({
    description: '变化后经验值',
    example: 105,
    required: true,
  })
  afterExperience!: number

  @StringProperty({
    description: '备注',
    example: '发表主题获得经验',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class QueryUserExperienceRecordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseUserExperienceRecordDto, ['ruleId'])),
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

  @NumberProperty({
    description: '规则类型',
    example: 1,
    required: true,
  })
  ruleType!: number

  @StringProperty({
    description: '备注',
    example: '发表主题获得经验',
    required: false,
    maxLength: 500,
  })
  remark?: string
}
