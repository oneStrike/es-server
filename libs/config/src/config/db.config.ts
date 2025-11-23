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
} = process.env

if (!DB_HOST) {
  throw new Error('缺少环境变量 DB_HOST 环境变量')
}

if (!DB_PORT) {
  throw new Error('缺少环境变量 DB_PORT 环境变量')
}

if (!DB_USER) {
  throw new Error('缺少环境变量 DB_USER 环境变量')
}

if (!DB_PASSWORD) {
  throw new Error('缺少环境变量 DB_PASSWORD 环境变量')
}

if (!DB_NAME) {
  throw new Error('缺少环境变量 DB_NAME 环境变量')
}

// 创建数据库配置对象
const dbConfig = {
  // 数据库连接配置
  connection: {
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    url: `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
  },

  // 分页列表的查询参数默认值
  pagination: {
    pageSize: DB_PAGINATION_PAGE_SIZE,
    pageIndex: DB_PAGINATION_PAGE_INDEX,
  },

  // 默认排序字段
  orderBy: {
    id: 'desc',
  },
}

export const DbConfig = dbConfig
export const DbConfigRegister = registerAs('db', () => DbConfig)
