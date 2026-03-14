import { GrowthRuleTypeEnum } from '@libs/growth'

// 可收藏的类型
export enum FavoriteTargetTypeEnum {
  // 漫画
  WORK_COMIC = 1,
  // 小说
  WORK_NOVEL = 2,
  // 帖子
  FORUM_TOPIC = 3,
}

// 收藏类型映射 Growth 类
export const FAVORITE_GROWTH_RULE_TYPE_MAP = {
  [FavoriteTargetTypeEnum.WORK_COMIC]: GrowthRuleTypeEnum.COMIC_WORK_FAVORITE,
  [FavoriteTargetTypeEnum.WORK_NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_FAVORITE,
  [FavoriteTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_FAVORITED,
}
