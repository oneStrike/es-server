/**
 * 内容权限业务错误提示。
 * 统一供权限服务抛出业务异常时复用，避免不同入口返回不一致文案。
 */
export const PERMISSION_ERROR_MESSAGE = {
  // 作品不存在或已软删除时的提示。
  WORK_NOT_FOUND: '作品不存在',
  // 章节不存在或已软删除时的提示。
  CHAPTER_NOT_FOUND: '章节不存在',
  // 用户不存在或已软删除时的提示。
  USER_NOT_FOUND: '用户不存在',
  // 用户等级经验不足以访问会员内容时的提示。
  MEMBER_LEVEL_INSUFFICIENT: '会员等级不足',
  // 配置的阅读会员等级不存在时的提示。
  REQUIRED_MEMBER_LEVEL_NOT_FOUND: '指定的阅读会员等级不存在',
  // 章节需要购买但当前用户未购买时的提示。
  CHAPTER_PURCHASE_REQUIRED: '请先购买该章节',
  // 作品级权限被错误配置为购买权限时的提示。
  WORK_PURCHASE_UNSUPPORTED: '作品不支持购买权限，请使用会员权限',
  // 权限枚举值不在支持范围内时的提示。
  UNKNOWN_PERMISSION_TYPE: '未知的权限类型',
  // 作品下载入口被权限规则拒绝时的提示。
  WORK_DOWNLOAD_FORBIDDEN: '作品禁止下载',
  // 章节下载入口被权限规则拒绝时的提示。
  CHAPTER_DOWNLOAD_FORBIDDEN: '章节禁止下载',
  // 访问需要登录但请求没有用户身份时的提示。
  CHAPTER_ACCESS_REQUIRED: '请先登录',
}
