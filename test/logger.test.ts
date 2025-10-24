import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test, TestingModule } from '@nestjs/testing'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { AppModule } from '@/app.module'
import { LoggerFactoryService } from '@/common/module/logger/logger-factory.service'

/**
 * 日志系统测试脚本
 * 用于验证日志功能是否正常工作
 */
async function testLogger() {
  console.log('🧪 开始测试日志系统...\n')

  // 创建测试应用
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  )

  const loggerFactory = app.get(LoggerFactoryService)

  console.log('✅ 应用创建成功\n')

  // 测试 1: Global Logger
  console.log('📝 测试 1: Global Logger')
  const globalLogger = loggerFactory.createGlobalLogger('TestScript')
  globalLogger.info('这是一条全局日志', { test: 'global', timestamp: new Date() })
  globalLogger.warn('这是一条警告日志', { level: 'warn' })
  globalLogger.error('这是一条错误日志', 'Error stack here', { error: 'test error' })
  console.log('✅ Global Logger 测试完成\n')

  // 测试 2: Admin Logger
  console.log('📝 测试 2: Admin Logger')
  const adminLogger = loggerFactory.createAdminLogger('TestScript')
  adminLogger.info('这是一条管理后台日志', { test: 'admin', userId: 1 })
  adminLogger.debug('管理后台调试信息', { details: 'debug info' })
  console.log('✅ Admin Logger 测试完成\n')

  // 测试 3: Client Logger
  console.log('📝 测试 3: Client Logger')
  const clientLogger = loggerFactory.createClientLogger('TestScript')
  clientLogger.info('这是一条客户端日志', { test: 'client', userId: 100 })
  clientLogger.warn('客户端警告', { warning: 'test warning' })
  console.log('✅ Client Logger 测试完成\n')

  // 测试 4: 日志上下文
  console.log('📝 测试 4: 日志上下文')
  globalLogger.setLogContext({
    requestId: 'test-req-123',
    userId: '999',
    ip: '127.0.0.1',
  })
  globalLogger.info('带上下文的日志', { action: 'test context' })
  globalLogger.clearContext()
  console.log('✅ 日志上下文测试完成\n')

  // 测试 5: 专用日志方法
  console.log('📝 测试 5: 专用日志方法')
  globalLogger.logRequest('GET', '/test/api', 200, 125, { testType: 'http' })
  globalLogger.logDatabase('SELECT', 'users', 45, { rows: 10 })
  globalLogger.logBusiness('test_operation', 'success', { data: 'test' })
  globalLogger.logSecurity('test_event', 'info', { severity: 'low' })
  globalLogger.logPerformance('test_operation', 1500, { records: 1000 })
  console.log('✅ 专用日志方法测试完成\n')

  // 测试 6: 子日志器
  console.log('📝 测试 6: 子日志器')
  const childLogger = globalLogger.child('SubModule', { childId: 'child-1' })
  childLogger.info('子日志器测试', { message: 'from child' })
  console.log('✅ 子日志器测试完成\n')

  // 等待日志写入完成
  await new Promise(resolve => setTimeout(resolve, 1000))

  await app.close()

  console.log('✅ 所有测试完成！')
  console.log('\n📁 请检查以下目录的日志文件：')
  console.log('   - logs/global/combined-{日期}.log')
  console.log('   - logs/admin/combined-{日期}.log')
  console.log('   - logs/client/combined-{日期}.log')
  console.log('   - logs/global/error-{日期}.log')
  console.log('\n💡 提示：日志文件应该包含 JSON 格式的日志记录，不再为空')
}

// 运行测试
testLogger()
  .then(() => {
    console.log('\n🎉 测试脚本执行成功')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  })
