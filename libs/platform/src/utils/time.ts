import process from 'node:process'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

const DEFAULT_APP_TIME_ZONE = 'Asia/Shanghai'
const DATE_ONLY_FORMAT = 'YYYY-MM-DD'
const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'

type AppDateInput = Date | string | number

export interface AppDateRange {
  gte?: Date
  lt?: Date
}

/**
 * 获取项目统一使用的 IANA 时区标识。
 * 未显式配置时回退到仓库既定口径 `Asia/Shanghai`。
 */
export function getAppTimeZone() {
  const configuredTimeZone = process.env.TZ?.trim()
  return configuredTimeZone || DEFAULT_APP_TIME_ZONE
}

/**
 * 将 `YYYY-MM-DD` 这种日期型输入解析为东八区当天 00:00 对应的绝对时间。
 * 解析失败时返回 `undefined`，避免业务层误把非法日期带入查询条件。
 */
export function parseDateOnlyInAppTimeZone(value: string) {
  const trimmedValue = value.trim()
  if (trimmedValue === '') {
    return undefined
  }

  const parsedValue = dayjs.tz(trimmedValue, DATE_ONLY_FORMAT, getAppTimeZone())
  if (
    !parsedValue.isValid()
    || parsedValue.format(DATE_ONLY_FORMAT) !== trimmedValue
  ) {
    return undefined
  }

  return parsedValue.startOf('day').toDate()
}

/**
 * 按东八区自然日构建 `[gte, lt)` 查询范围。
 * 结束日期会自动推进到次日 00:00，避免业务层重复手写加一天逻辑。
 */
export function buildDateOnlyRangeInAppTimeZone(
  startDate?: string,
  endDate?: string,
) {
  const dateRange: AppDateRange = {}

  if (startDate) {
    const parsedStartDate = parseDateOnlyInAppTimeZone(startDate)
    if (parsedStartDate) {
      dateRange.gte = parsedStartDate
    }
  }

  if (endDate) {
    const parsedEndDate = parseDateOnlyInAppTimeZone(endDate)
    if (parsedEndDate) {
      dateRange.lt = dayjs(parsedEndDate)
        .tz(getAppTimeZone())
        .add(1, 'day')
        .toDate()
    }
  }

  return Object.keys(dateRange).length > 0 ? dateRange : undefined
}

/**
 * 获取给定时间在东八区的自然日开始时刻。
 * 适用于“今日累计”“按天限额”等业务口径。
 */
export function startOfDayInAppTimeZone(value: AppDateInput) {
  return dayjs(value).tz(getAppTimeZone()).startOf('day').toDate()
}

/**
 * 获取“今天 00:00”的东八区绝对时间。
 */
export function startOfTodayInAppTimeZone(now: AppDateInput = new Date()) {
  return startOfDayInAppTimeZone(now)
}

/**
 * 获取给定基准时间在东八区向前若干天后的绝对时间。
 * 保留当前时分秒，适用于“最近 7 天”这类滚动窗口统计。
 */
export function subtractDaysInAppTimeZone(
  days: number,
  base: AppDateInput = new Date(),
) {
  return dayjs(base).tz(getAppTimeZone()).subtract(days, 'day').toDate()
}

/**
 * 获取给定基准时间在东八区向前若干月后的绝对时间。
 * 保留当前时分秒，适用于“最近 1 个月”这类滚动窗口统计。
 */
export function subtractMonthsInAppTimeZone(
  months: number,
  base: AppDateInput = new Date(),
) {
  return dayjs(base).tz(getAppTimeZone()).subtract(months, 'month').toDate()
}

/**
 * 将时间格式化为东八区自然日字符串 `YYYY-MM-DD`。
 * 适用于日期型字段、目录分桶和每日限额 key。
 */
export function formatDateOnlyInAppTimeZone(value: AppDateInput) {
  return dayjs(value).tz(getAppTimeZone()).format(DATE_ONLY_FORMAT)
}

/**
 * 将时间格式化为东八区本地时间字符串 `YYYY-MM-DD HH:mm:ss`。
 * 适用于用户可读提示文案，不携带偏移量以保持现有展示风格。
 */
export function formatDateTimeInAppTimeZone(value: AppDateInput) {
  return dayjs(value).tz(getAppTimeZone()).format(DATE_TIME_FORMAT)
}

/**
 * 生成东八区自然日 key。
 * 语义上等价于 `YYYY-MM-DD`，单独导出便于业务代码表达“按天分桶”意图。
 */
export function formatDateKeyInAppTimeZone(value: AppDateInput) {
  return formatDateOnlyInAppTimeZone(value)
}
