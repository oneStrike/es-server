import process from 'node:process'

import { Injectable, OnApplicationShutdown } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv'
import { PrismaClient } from '@/prisma/client/client'
import { exists, findPagination, maxOrder, softDelete } from './extensions'

dotenv.config({
  path: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env',
})
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
export const prisma = new PrismaClient({ adapter }).$extends({
  model: {
    $allModels: {
      exists,
      ...softDelete,
      findPagination,
      maxOrder,
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
