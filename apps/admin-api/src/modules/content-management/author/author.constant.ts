/**
 * 作者模块常量定义
 */

/// 作者性别枚举
export enum AuthorGenderEnum {
  /** 未知 */
  UNKNOWN = 0,
  /** 男性 */
  MALE = 1,
  /** 女性 */
  FEMALE = 2,
  /** 其他 */
  OTHER = 3,
}

// 作者类型bitMask
/** 漫画家 */
export enum AuthorTypeEnum {
  /** 漫画家 */
  MANGA = 1,
  /** 轻小说作者 */
  LIGHT_NOVEL = 2,
  /** 插画师 */
  ILLUSTRATOR = 4,
  /** coser */
  COSER = 8,
}
