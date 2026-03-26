/**
 * 打印应用启动信息到控制台
 *
 * 输出本地访问地址、API 文档地址、健康检查与就绪检查地址。
 * 仅在应用启动时调用一次，用于开发调试与运维确认。
 *
 * @param port - 应用监听端口
 * @param swaggerPath - Swagger 文档路径，默认 'api-doc'
 */
export function logStartupInfo(port: number | string, swaggerPath = 'api-doc') {
  console.log(`📍 本地访问地址: http://localhost:${port}`)
  console.log(`📍 网络访问地址: http://127.0.0.1:${port}`)
  console.log(`👥 API文档: http://localhost:${port}/${swaggerPath}`)
  console.log(
    `💚 健康检查(liveness): http://localhost:${port}/api/system/health`,
  )
  console.log(
    `💙 就绪检查(readiness): http://localhost:${port}/api/system/ready`,
  )
}
