import process from 'node:process'
import { registerAs } from '@nestjs/config'

export const DbConfig = {
  // 数据库连接配置
  connection: process.env.DATABASE_URL,
  query: {
    pageSize: 15,
    pageIndex: 0,
    maxListItemLimit: 500,
    orderBy: {
      id: 'desc',
    },
  },
}
export const DbConfigRegister = registerAs('db', () => DbConfig)
