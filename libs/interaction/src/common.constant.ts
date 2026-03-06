/**
 * 交互模块常量定义
 */

// 从 libs/base 导入统一的审核和举报枚举
export {
  AuditRoleEnum,
  AuditRoleNames,
  AuditStatusEnum,
  AuditStatusNames,
  ReportStatusEnum,
  ReportStatusNames,
} from '@libs/base/constant'

/**
 * 交互操作类型枚举
 * 用于标识用户对目标执行的操作类型
 */
export enum InteractionActionType {
  /** 点赞 - 用户对目标表示认可 */
  LIKE = 1,
  /** 取消点赞 - 用户撤回点赞操作 */
  UNLIKE = 2,
  /** 收藏 - 用户将目标加入收藏夹 */
  FAVORITE = 3,
  /** 取消收藏 - 用户从收藏夹移除目标 */
  UNFAVORITE = 4,
  /** 浏览 - 用户查看目标内容 */
  VIEW = 5,
  /** 删除浏览记录 - 用户删除自己的浏览记录 */
  DELETE_VIEW = 6,
  /** 评论 - 用户对目标发表评论 */
  COMMENT = 7,
  /** 删除评论 - 用户删除自己的评论 */
  DELETE_COMMENT = 8,
  /** 下载 - 用户下载目标内容 */
  DOWNLOAD = 9,
  /** 购买 - 用户购买目标内容 */
  PURCHASE = 10,
  /** 退款 - 用户申请退款 */
  REFUND = 11,
}
