import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

async function runMigration() {
  console.log('⏳ 开始执行数据库迁移...')

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL 环境变量未设置')
    process.exit(1)
  }

  // 必须使用数据库直连配置，max: 1 表示只需要一个连接
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  })

  const db = drizzle(pool)
  let isFreshDb = false

  try {
    // 检查是否是刚创建的空数据库 (通过判断有没有迁移记录表)
    const result = await pool.query(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '__drizzle_migrations__'",
    )
    isFreshDb = Number.parseInt(result.rows[0].count, 10) === 0

    if (isFreshDb) {
      console.log('🆕 检测到全新的空数据库，迁移结束后将自动执行 Seed')
    }

    // 指向由 drizzle.config.ts out 配置项指定的迁移文件夹
    // 使用绝对路径避免执行目录不同的问题
    const migrationsFolder = resolve(__dirname, 'migration')
    console.log(`📁 迁移文件目录: ${migrationsFolder}`)

    await migrate(db, { migrationsFolder })
    console.log('✅ 数据库迁移成功！')
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error)
    process.exit(1)
  } finally {
    // 务必关闭连接池
    await pool.end()
  }

  // 迁移完成且连接池释放后，如果是空数据库，则自动执行 seed
  if (isFreshDb) {
    console.log('🌱 开始自动注入种子数据...')
    const seedTsPath = join(process.cwd(), 'db', 'seed', 'index.ts')

    try {
      if (existsSync(seedTsPath)) {
        // 由于你的生产环境 Docker 是基于 oven/bun 的，它可以原生直接运行 TS
        execSync(`bun ${seedTsPath}`, { stdio: 'inherit' })
      } else {
        console.warn('⚠️ 找不到种子数据脚本文件，跳过 Auto-Seed')
      }
    } catch (seedError) {
      console.error('❌ Auto-Seed 执行失败:', seedError)
      process.exit(1)
    }
  }
}

runMigration()
