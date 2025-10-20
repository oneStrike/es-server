export type PublicKeyResponse = RsaPublicKeyDto;

/**
 *  类型定义 [RsaPublicKeyDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type RsaPublicKeyDto = {
  /* RSA公钥 */
  publicKey: string;

  /** 任意合法数值 */
  [property: string]: any;
};
