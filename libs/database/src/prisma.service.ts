import { Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  exists,
  findPagination,
  maxOrder,
  softDelete,
  swapField,
} from './extensions'
import { PrismaClient } from './prisma-client/client'

export function makePrismaClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter }).$extends({
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
}
export type PrismaClientType = ReturnType<typeof makePrismaClient>

@Injectable()
export class PrismaService implements OnApplicationShutdown {
  public readonly client: PrismaClientType

  constructor(private readonly configService: ConfigService) {
    const DATABASE_URL = this.configService.get('db.connection.url')
    this.client = makePrismaClient(DATABASE_URL)
  }

  createPrismaClient(): PrismaClientType {
    return this.client
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect()
  }
}
