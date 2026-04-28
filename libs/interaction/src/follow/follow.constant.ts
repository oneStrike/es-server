/**
 * 关注目标类型枚举
 * 用于统一标识用户关注的业务目标
 */
export enum FollowTargetTypeEnum {
  /** 用户 */
  USER = 1,
  /** 作者 */
  AUTHOR = 2,
  /** 论坛板块 */
  FORUM_SECTION = 3,
  /** 论坛话题（hashtag） */
  FORUM_HASHTAG = 4,
}
