/** 积分流水输出所需的账本记录字段视图，兼容管理端和 app 分页映射。 */
export interface LedgerRecordShape {
  id: number
  userId: number
  ruleId: number | null
  ruleType?: number | null
  targetType: number | null
  targetId: number | null
  delta: number
  beforeValue: number
  afterValue: number
  bizKey?: string
  createdAt: Date
  updatedAt?: Date
  remark: string | null
  context?: Record<string, unknown> | null
}
