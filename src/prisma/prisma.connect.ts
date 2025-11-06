import process from 'node:process'

import { Injectable, OnApplicationShutdown } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv'
import { PrismaClient } from '@/prisma/client/client'
import {
  exists,
  findPagination,
  maxOrder,
  softDelete,
  swapField,
} from './extensions'

dotenv.config({
  path: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env',
})

const {
  POSTGRES_DB,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB_HOST,
  POSTGRES_DB_PORT,
  DATABASE_URL,
} = process.env

// 优先使用 DATABASE_URL（便于与 Prisma CLI 保持一致）；
// 若未提供，则回退到基于 POSTGRES_* 变量拼接的连接字符串。
const connectionString =
  DATABASE_URL
  ?? `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_DB_HOST}:${POSTGRES_DB_PORT}/${POSTGRES_DB}`

const adapter = new PrismaPg({ connectionString })
export const prisma = new PrismaClient({ adapter }).$extends({
  model: {
    $allModels: {
      exists,
      ...softDelete,
      findPagination,
      maxOrder,
      swapField,
    },
  },
})
export type PrismaClientType = typeof prisma

@Injectable()
export class PrismaService implements OnApplicationShutdown {
  public readonly client: PrismaClientType = prisma

  createPrismaClient(): PrismaClientType {
    return this.client
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect()
  }
}
