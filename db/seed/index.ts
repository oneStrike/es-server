import process from 'node:process'
import { createDbClient, disconnectDbClient, getDatabaseUrl, type Db } from './db-client'

// Admin modules
import { seedAdminAccount } from './modules/admin'

// App modules
import { seedAppConfig, seedAppPages, seedAppUsers } from './modules/app'

// Forum modules
import { seedForumSectionGroups, seedForumSections, seedForumTopics } from './modules/forum'

// System modules
import { seedDictionaries } from './modules/system'

// Work modules
import { seedWorkAuthors, seedWorkCategories, seedWorkTags, seedWorks } from './modules/work'

/**
 * 执行所有种子任务
 * 注意：执行顺序很重要，需要保证业务关联性
 */
async function runSeeds() {
  console.log('🌱 开始初始化 Drizzle 种子数据...\n')

  const db = createDbClient(getDatabaseUrl())

  try {
    // ========== 第一阶段：基础配置数据（无依赖） ==========
    console.log('📦 第一阶段：基础配置数据\n')

    await seedDictionaries(db)
    await seedWorkCategories(db)
    await seedWorkTags(db)
    await seedForumSectionGroups(db)
    await seedAdminAccount(db)

    console.log('\n✅ 基础配置数据初始化完成\n')

    // ========== 第二阶段：业务基础数据 ==========
    console.log('📦 第二阶段：业务基础数据\n')

    await seedForumSections(db)
    await seedWorkAuthors(db)

    console.log('\n✅ 业务基础数据初始化完成\n')

    // ========== 第三阶段：核心业务数据 ==========
    console.log('📦 第三阶段：核心业务数据\n')

    // 创建作品（会自动创建关联的论坛板块）
    const works = await seedWorks(db)

    console.log('\n✅ 核心业务数据初始化完成\n')

    // ========== 第四阶段：用户相关数据 ==========
    console.log('📦 第四阶段：用户相关数据\n')

    const users = await seedAppUsers(db)

    // 应用配置需要关联用户ID
    const adminUser = await db.query.adminUser.findFirst()
    await seedAppConfig(db, adminUser?.id)
    await seedAppPages(db)

    console.log('\n✅ 用户相关数据初始化完成\n')

    // ========== 第五阶段：论坛内容数据 ==========
    console.log('📦 第五阶段：论坛内容数据\n')

    await seedForumTopics(db)

    console.log('\n✅ 论坛内容数据初始化完成\n')

    console.log('🎉 所有 Drizzle 种子数据初始化完成！')
  } catch (error) {
    console.error('❌ 种子数据初始化失败:', error)
    throw error
  } finally {
    await disconnectDbClient(db)
  }
}

// 执行种子任务
runSeeds()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
