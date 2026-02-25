import process from 'node:process'
import { makePrismaClient } from '../../libs/base/src/database'
import { isProduction } from '../../libs/base/src/utils'
import { DbConfig } from '../../libs/base/src/config'
import { migrateInteractionData } from './migrate-interaction-data'

const connectUrl = isProduction()
  ? DbConfig.connection.url
  : 'postgresql://postgres:259158@localhost:5432/foo'
const prisma = makePrismaClient(connectUrl)

async function runMigration() {
  console.log('🚀 开始执行数据迁移...')
  console.log('')

  await migrateInteractionData(prisma)

  console.log('')
  console.log('🎉 数据迁移完成！')
}

runMigration()
  .catch((error) => {
    console.error('❌ 迁移失败:', error)
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
