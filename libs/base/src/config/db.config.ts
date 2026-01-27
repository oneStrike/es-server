import process from 'node:process'
import { registerAs } from '@nestjs/config'

// 从环境变量中提取配置
const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_PAGINATION_PAGE_SIZE = 15,
  DB_PAGINATION_PAGE_INDEX = 0,
  DB_MAX_QUERY_LIST_LIMIT = 500,
} = process.env

export const DbConfig = {
  // 数据库连接配置
  connection: {
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    url: `postgresql://${encodeURIComponent(DB_USER!)}:${encodeURIComponent(DB_PASSWORD!)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
  },
  query: {
    pageSize: Number.isFinite(DB_PAGINATION_PAGE_SIZE)
      ? Math.floor(Number(DB_PAGINATION_PAGE_SIZE))
      : 15,

    pageIndex: Number.isFinite(DB_PAGINATION_PAGE_INDEX)
      ? Math.floor(Number(DB_PAGINATION_PAGE_INDEX))
      : 0,
    maxListItemLimit: Number.isFinite(DB_MAX_QUERY_LIST_LIMIT)
      ? Math.floor(Number(DB_MAX_QUERY_LIST_LIMIT))
      : 500,
    orderBy: {
      id: 'desc',
    },
  },
}
export const DbConfigRegister = registerAs('db', () => DbConfig)
