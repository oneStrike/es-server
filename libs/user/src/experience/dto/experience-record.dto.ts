import { ValidateNumber, ValidateString } from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

export class BaseUserExperienceRecordDto extends BaseDto {
  @ValidateNumber({
    description: '关联的用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateNumber({
    description: '关联的规则ID',
    example: 1,
    required: false,
  })
  ruleId?: number

  @ValidateNumber({
    description: '经验值变化',
    example: 5,
    required: true,
  })
  experience!: number

  @ValidateNumber({
    description: '变化前经验值',
    example: 100,
    required: true,
  })
  beforeExperience!: number

  @ValidateNumber({
    description: '变化后经验值',
    example: 105,
    required: true,
  })
  afterExperience!: number

  @ValidateString({
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
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class AddUserExperienceDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateNumber({
    description: '规则类型',
    example: 1,
    required: true,
  })
  ruleType!: number

  @ValidateString({
    description: '备注',
    example: '发表主题获得经验',
    required: false,
    maxLength: 500,
  })
  remark?: string
}
