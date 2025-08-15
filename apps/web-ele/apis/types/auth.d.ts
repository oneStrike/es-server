export type PublicKeyResponse = RsaPublicKeyDto

/**
 *  类型定义 [RsaPublicKeyDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:38
 */
export type RsaPublicKeyDto = {
  /* RSA公钥 */
  publicKey: string

  /** 任意合法数值 */
  [property: string]: any
}