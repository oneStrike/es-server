/**
 * 打印应用启动信息
 */
export function logStartupInfo(port: number | string) {
  console.log(`🚀 应用程序已启动`)
  console.log(`📍 本地访问地址: http://localhost:${port}`)
  console.log(`📍 网络访问地址: http://127.0.0.1:${port}`)
  console.log(`🔧 管理后台 API: http://localhost:${port}/api/admin`)
  console.log(`👥 客户端 API: http://localhost:${port}/api/client`)
  console.log(
    `💚 健康检查(liveness): http://localhost:${port}/api/system/health`,
  )
  console.log(
    `💙 就绪检查(readiness): http://localhost:${port}/api/system/ready`,
  )
}
