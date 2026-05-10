import {
  BooleanProperty,
  DateProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { CreatePaymentOrderBaseDto } from '../../payment/dto/payment.dto'

export class BaseCurrencyPackageDto extends BaseDto {
  @StringProperty({
    description: '充值包业务键',
    example: 'coin_1000',
  })
  packageKey!: string

  @StringProperty({
    description: '充值包名称',
    example: '1000 阅读币',
  })
  name!: string

  @NumberProperty({
    description: '支付价格，单位为分',
    example: 1000,
    min: 0,
  })
  price!: number

  @NumberProperty({
    description: '发放虚拟币数量',
    example: 1000,
    min: 1,
  })
  currencyAmount!: number

  @NumberProperty({
    description: '赠送虚拟币数量',
    example: 100,
    min: 0,
    required: false,
    default: 0,
  })
  bonusAmount?: number

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    required: false,
    default: 0,
  })
  sortOrder?: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
    default: true,
  })
  isEnabled?: boolean
}

export class CreateCurrencyPackageDto extends PickType(BaseCurrencyPackageDto, [
  'packageKey',
  'name',
  'price',
  'currencyAmount',
  'bonusAmount',
  'sortOrder',
  'isEnabled',
] as const) {}

export class UpdateCurrencyPackageDto extends IntersectionType(
  IdDto,
  PartialType(CreateCurrencyPackageDto),
) {}

export class QueryCurrencyPackageDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseCurrencyPackageDto, ['name', 'isEnabled'] as const)),
) {}

export class CreateCurrencyRechargeOrderDto extends CreatePaymentOrderBaseDto {
  @NumberProperty({
    description: '充值包 ID',
    example: 1,
  })
  packageId!: number
}

export class WalletDetailDto {
  @NumberProperty({
    description: '虚拟币余额',
    example: 1000,
    validation: false,
  })
  currencyBalance!: number

  @DateProperty({
    description: 'VIP 到期时间',
    example: '2026-06-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  vipExpiresAt?: Date | null

  @NumberProperty({
    description: '可用券数量',
    example: 3,
    validation: false,
  })
  availableCouponCount!: number

  @NumberProperty({
    description: '已购作品数',
    example: 5,
    validation: false,
  })
  purchasedWorkCount!: number

  @NumberProperty({
    description: '已购章节数',
    example: 42,
    validation: false,
  })
  purchasedChapterCount!: number
}
