import { ValidateNumber } from '@libs/base/decorators'
import { BaseDto, IdDto } from '@libs/base/dto'
import { IntersectionType, PickType } from '@nestjs/swagger'

/**
 * 回复点赞基础DTO
 * 包含回复点赞的所有基础字段定义
 */
export class BaseForumReplyLikeDto extends BaseDto {
  @ValidateNumber({
    description: '关联的回复ID',
    example: 1,
    required: true,
    min: 1,
  })
  replyId!: number

  @ValidateNumber({
    description: '关联的用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number
}

export class CreateForumReplyLikeDto extends PickType(BaseForumReplyLikeDto, [
  'replyId',
  'userId',
]) {}

export class DeleteForumReplyLikeDto extends IntersectionType(
  IdDto,
  PickType(BaseForumReplyLikeDto, ['userId']),
) {}
