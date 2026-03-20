import process from 'node:process'
import { createDbClient, disconnectDbClient, getDatabaseUrl } from './db-client'
import { seedAdminDomain } from './modules/admin'
import { seedAppActivityDomain, seedAppCoreDomain } from './modules/app'
import { seedForumActivityDomain, seedForumReferenceDomain } from './modules/forum'
import { seedMessageDomain } from './modules/message'
import { seedSystemOperationalData, seedSystemReferenceData } from './modules/system'
import { seedWorkDomain } from './modules/work'

async function runSeeds() {
  console.log('🌱 开始初始化 Drizzle 种子数据...\n')

  const db = createDbClient(getDatabaseUrl())

  try {
    console.log('📦 第一阶段：全局参考数据\n')
    await seedSystemReferenceData(db)
    await seedAdminDomain(db)
    await seedAppCoreDomain(db)
    await seedForumReferenceDomain(db)
    console.log('\n✅ 全局参考数据初始化完成\n')

    console.log('📦 第二阶段：内容与社区主体数据\n')
    await seedWorkDomain(db)
    await seedForumActivityDomain(db)
    console.log('\n✅ 内容与社区主体数据初始化完成\n')

    console.log('📦 第三阶段：互动与消息数据\n')
    await seedAppActivityDomain(db)
    await seedMessageDomain(db)
    console.log('\n✅ 互动与消息数据初始化完成\n')

    console.log('📦 第四阶段：系统运行数据\n')
    await seedSystemOperationalData(db)
    console.log('\n✅ 系统运行数据初始化完成\n')

    console.log('🎉 所有 Drizzle 种子数据初始化完成！')
  } catch (error) {
    console.error('❌ 种子数据初始化失败:', error)
    throw error
  } finally {
    await disconnectDbClient(db)
  }
}

runSeeds()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
