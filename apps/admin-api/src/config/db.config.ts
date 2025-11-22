import process from 'node:process'
import { registerAs } from '@nestjs/config'

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  MAX_QUERY_LIST_LIMIT,
  PAGINATION_PAGE_SIZE,
  PAGINATION_PAGE_INDEX,
} = process.env

export const DbConfig = {
  // 数据库连接配置
  connection: {
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    url: `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
  },

  // 单次列表查询的最大条数上线
  maxListItemLimit: MAX_QUERY_LIST_LIMIT || 500,
  // 分页列表的查询参数默认列表
  pagination: {
    pageSize: PAGINATION_PAGE_SIZE || 15,
    pageIndex: PAGINATION_PAGE_INDEX || 0,
  },

  // 默认排序字段
  orderBy: {
    id: 'desc',
  },
}

export const DbConfigRegister = registerAs('db', () => DbConfig)
