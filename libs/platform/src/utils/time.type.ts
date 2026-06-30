/**
 * 应用时区工具可接受的时间输入。
 */
export type AppDateInput = Date | string | number

/**
 * 按 `[gte, lt)` 语义表达的日期查询范围。
 */
export interface AppDateRange {
  gte?: Date
  lt?: Date
}

/**
 * 自然日字符串在应用时区下的派生日期信息。
 */
export interface AppDateOnlyParts {
  dayOfMonth: number
  daysInMonth: number
  monthEndDate: string
  monthStartDate: string
  weekday: number
}
