import process from 'node:process'
import { sql } from 'drizzle-orm'
import { createDbClient, disconnectDbClient, getDatabaseUrl } from './db-client'
import { seedAdminDomain } from './modules/admin'
import { seedAppActivityDomain, seedAppCoreDomain } from './modules/app'
import {
  seedForumActivityDomain,
  seedForumReferenceDomain,
} from './modules/forum'
import { seedMessageDomain } from './modules/message'
import {
  seedSystemOperationalData,
  seedSystemReferenceData,
} from './modules/system'
import { seedWorkDomain } from './modules/work'

async function runSeeds() {
  console.log('🌱 开始初始化 Drizzle 种子数据...\n')

  const db = createDbClient(getDatabaseUrl())

  try {
    await db.execute(sql`
      DO $$
      DECLARE
        row_record record;
        seq_name text;
        max_id bigint;
      BEGIN
        FOR row_record IN
          SELECT table_schema, table_name
          FROM information_schema.columns
          WHERE column_name = 'id'
            AND table_schema = 'public'
        LOOP
          seq_name := pg_get_serial_sequence(
            format('%I.%I', row_record.table_schema, row_record.table_name),
            'id'
          );
          IF seq_name IS NOT NULL THEN
            EXECUTE format(
              'SELECT COALESCE(MAX(id), 0) FROM %I.%I',
              row_record.table_schema,
              row_record.table_name
            ) INTO max_id;
            EXECUTE format(
              'SELECT setval(%L, %s, false)',
              seq_name,
              max_id + 1
            );
          END IF;
        END LOOP;
      END $$;
    `)

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
