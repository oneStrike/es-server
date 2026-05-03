import type { BaseAgreementDto } from './dto/agreement.dto'

/** 协议 HTML 渲染所需的最小字段视图，供 admin/app 直出页共享。 */
export type AgreementHtmlView = Pick<
  BaseAgreementDto,
  'title' | 'version' | 'content'
>
