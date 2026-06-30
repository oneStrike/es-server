/** 当前进程激活中的 ip2region 数据库元信息，持久化到 active 目录 metadata.json。 */
export interface ActiveMetadata {
  activeFileName: string
  originalFileName: string
  activatedAt: string
  fileSize: number
}
