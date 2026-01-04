import process from 'node:process'
import { makePrismaClient } from '@libs/base/database'
import { isProduction } from '@libs/base/utils'
import { DbConfig } from '../../config'

const connectUrl = isProduction()
  ? DbConfig.connection.url
  : 'postgresql://postgres:259158@localhost:5432/foo'
const prisma = makePrismaClient(connectUrl)

interface TableCheckResult {
  tableName: string
  count: number
  status: 'success' | 'warning' | 'error'
  message: string
}

async function checkTable(tableName: string, expectedMinCount: number = 0): Promise<TableCheckResult> {
  try {
    const count = await (prisma as any)[tableName].count()

    if (count === 0) {
      return {
        tableName,
        count,
        status: 'warning',
        message: `表 ${tableName} 中没有数据`,
      }
    }

    if (count < expectedMinCount) {
      return {
        tableName,
        count,
        status: 'warning',
        message: `表 ${tableName} 数据量不足，期望至少 ${expectedMinCount} 条，实际 ${count} 条`,
      }
    }

    return {
      tableName,
      count,
      status: 'success',
      message: `表 ${tableName} 数据正常，共 ${count} 条记录`,
    }
  } catch (error) {
    return {
      tableName,
      count: 0,
      status: 'error',
      message: `表 ${tableName} 检查失败: ${error}`,
    }
  }
}

async function verifySeedData() {
  console.log('🔍 开始验证种子数据完整性...\n')

  const results: TableCheckResult[] = []

  console.log('📊 检查基础配置数据...')
  results.push(await checkTable('adminUser', 1))
  results.push(await checkTable('dictionary', 1))
  results.push(await checkTable('dictionaryItem', 10))
  results.push(await checkTable('memberLevel', 3))

  console.log('\n📚 检查作品管理数据...')
  results.push(await checkTable('workCategory', 5))
  results.push(await checkTable('workTag', 10))
  results.push(await checkTable('workAuthor', 5))
  results.push(await checkTable('workComic', 5))
  results.push(await checkTable('workComicChapter', 10))
  results.push(await checkTable('workComicAuthor', 5))
  results.push(await checkTable('workComicCategory', 5))
  results.push(await checkTable('workComicTag', 10))

  console.log('\n🖥️ 检查客户端配置数据...')
  results.push(await checkTable('clientPage', 1))
  results.push(await checkTable('clientNotice', 1))

  console.log('\n💬 检查论坛配置数据...')
  results.push(await checkTable('forumSection', 3))
  results.push(await checkTable('forumTag', 10))
  results.push(await checkTable('forumBadge', 5))
  results.push(await checkTable('forumPointRule', 5))
  results.push(await checkTable('forumLevelRule', 5))
  results.push(await checkTable('forumSensitiveWord', 10))

  console.log('\n📋 验证结果汇总:')
  console.log('='.repeat(80))

  let successCount = 0
  let warningCount = 0
  let errorCount = 0

  results.forEach((result) => {
    const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
    console.log(`${icon} ${result.tableName.padEnd(25)} ${result.count.toString().padStart(6)} 条 - ${result.message}`)

    if (result.status === 'success')
{ successCount++ }
    else if (result.status === 'warning')
{ warningCount++ }
    else { errorCount++ }
  })

  console.log('='.repeat(80))
  console.log(`\n总计: ${results.length} 个表`)
  console.log(`✅ 成功: ${successCount} 个`)
  console.log(`⚠️ 警告: ${warningCount} 个`)
  console.log(`❌ 错误: ${errorCount} 个`)

  if (errorCount > 0) {
    console.log('\n❌ 验证失败，请检查错误信息')
    process.exit(1)
  } else if (warningCount > 0) {
    console.log('\n⚠️ 验证完成，但存在警告，请检查警告信息')
  } else {
    console.log('\n🎉 验证通过，所有种子数据完整！')
  }
}

verifySeedData()
  .catch((error) => {
    console.error('🚀 ~ error:', error)
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
