/**
 * 打印应用启动信息
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
