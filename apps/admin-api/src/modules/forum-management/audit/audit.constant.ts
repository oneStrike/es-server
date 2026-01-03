/**
 * 审核对象类型枚举
 */
export enum AuditObjectTypeEnum {
  /** 主题 */
  TOPIC = 1,
  /** 回复 */
  REPLY = 2,
}

/**
 * 审核对象类型名称映射
 */
export const AuditObjectTypeNames: Record<AuditObjectTypeEnum, string> = {
  [AuditObjectTypeEnum.TOPIC]: '主题',
  [AuditObjectTypeEnum.REPLY]: '回复',
}

/**
 * 审核状态枚举
 */
export enum AuditStatusEnum {
  /** 待审核 */
  PENDING = 0,
  /** 已通过 */
  APPROVED = 1,
  /** 已拒绝 */
  REJECTED = 2,
}

/**
 * 审核状态名称映射
 */
export const AuditStatusNames: Record<AuditStatusEnum, string> = {
  [AuditStatusEnum.PENDING]: '待审核',
  [AuditStatusEnum.APPROVED]: '已通过',
  [AuditStatusEnum.REJECTED]: '已拒绝',
}
