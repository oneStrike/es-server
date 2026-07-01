import type { LikePageQueryDto, LikeRecordDto } from './dto/like.dto'

/** 用户点赞分页查询入参，在分页 DTO 基础上补充 userId。 */
export type LikePageUserQuery = LikePageQueryDto & Pick<LikeRecordDto, 'userId'>
