# 购买模块 - 共识文档

## 1. 需求确认

### 1.1 功能范围

| 项目 | 确认内容 |
|------|----------|
| 购买目标 | 支持章节购买 + 作品整本购买 |
| 支付方式 | 多种支付方式（积分、余额、支付宝、微信） |
| 数据模型 | 使用 UserPurchaseRecord |
| 退款功能 | 需要支持退款 |
| 第三方支付 | 预留接口，后续集成 |

### 1.2 数据模型调整

需要调整以下模型字段：

| 模型 | 原字段 | 新字段 | 说明 |
|------|--------|--------|------|
| AppUser | points | 保持不变 | 积分字段继续使用 |
| AppUser | - | balance | 新增余额字段 |
| WorkChapter | readPoints | price | 通用价格字段 |
| Work | - | price | 新增作品价格字段 |

### 1.3 验收标准

1. 用户可以购买漫画/小说作品或单个章节
2. 支持积分、余额、支付宝、微信四种支付方式
3. 购买成功后更新购买计数
4. 支持查询用户购买记录
5. 支持批量检查购买状态
6. 支持退款功能，退款后返还积分/余额
7. 第三方支付接口预留

## 2. 技术实现方案

### 2.1 模块结构

```
libs/interaction/src/purchase/
├── purchase.service.ts    # 核心服务
├── purchase.constant.ts   # 常量定义
├── purchase.dto.ts        # DTO 定义
├── purchase.module.ts     # NestJS 模块定义
└── index.ts               # 导出文件
```

### 2.2 常量定义

```typescript
// purchase.constant.ts

/** 购买目标类型枚举 */
export enum PurchaseTargetTypeEnum {
  /** 漫画 */
  COMIC = 1,
  /** 小说 */
  NOVEL = 2,
  /** 漫画章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 */
  NOVEL_CHAPTER = 4,
}

/** 购买状态枚举 */
export enum PurchaseStatusEnum {
  /** 成功 */
  SUCCESS = 1,
  /** 失败 */
  FAILED = 2,
  /** 退款中 */
  REFUNDING = 3,
  /** 已退款 */
  REFUNDED = 4,
}

/** 支付方式枚举 */
export enum PaymentMethodEnum {
  /** 积分 */
  POINTS = 1,
  /** 余额 */
  BALANCE = 2,
  /** 支付宝 */
  ALIPAY = 3,
  /** 微信 */
  WECHAT = 4,
}
```

### 2.3 DTO 定义

```typescript
// purchase.dto.ts

import { EnumProperty, NumberProperty, StringProperty } from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { PaymentMethodEnum, PurchaseStatusEnum, PurchaseTargetTypeEnum } from '../purchase.constant'

/** 基础购买记录 DTO */
export class BaseUserPurchaseRecordDto extends BaseDto {
  @EnumProperty({
    description: '目标类型：1=漫画, 2=小说, 3=漫画章节, 4=小说章节',
    enum: PurchaseTargetTypeEnum,
    example: 1,
    required: true,
  })
  targetType!: PurchaseTargetTypeEnum

  @NumberProperty({
    description: '目标ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '购买价格（单位：积分或余额的最小单位）',
    example: 100,
    required: true,
  })
  price!: number

  @EnumProperty({
    description: '支付方式：1=积分, 2=余额, 3=支付宝, 4=微信',
    enum: PaymentMethodEnum,
    example: 1,
    required: true,
  })
  paymentMethod!: PaymentMethodEnum
}

/** 购买请求 DTO */
export class PurchaseTargetDto extends BaseUserPurchaseRecordDto {
  @StringProperty({
    description: '第三方支付订单号（支付宝/微信支付时使用）',
    example: '2024010123456789',
    required: false,
  })
  outTradeNo?: string
}

/** 查询购买记录 DTO */
export class QueryUserPurchaseRecordDto extends IntersectionType(
  IntersectionType(
    PageDto,
    PartialType(PickType(BaseUserPurchaseRecordDto, ['targetType'])),
  ),
  IntersectionType(
    PickType(BaseUserPurchaseRecordDto, ['userId']),
    PartialType(
      PickType(BaseUserPurchaseRecordDto, ['status' as any] as any),
    ),
  ),
) {}

/** 退款请求 DTO */
export class RefundPurchaseDto extends BaseDto {
  @NumberProperty({
    description: '购买记录ID',
    example: 1,
    required: true,
  })
  purchaseId!: number

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @StringProperty({
    description: '退款原因',
    example: '不想要了',
    required: false,
  })
  reason?: string
}
```

### 2.4 服务核心方法

```typescript
// purchase.service.ts

/**
 * 购买权限配置接口
 * 用于统一处理作品和章节的购买权限校验
 */
interface PurchasePermissionConfig {
  /** 购买规则：0=禁止, 1=所有人, 2=会员, 3=积分购买 */
  purchaseRule: number
  /** 购买所需价格 */
  price: number | null
  /** 要求的会员等级ID */
  requiredPurchaseLevelId: number | null
  /** 要求的会员等级信息 */
  requiredPurchaseLevel: { requiredExperience: number } | null
}

/**
 * 购买服务
 * 负责处理作品和章节的购买功能，包括权限校验、购买记录管理、支付处理、退款等
 */
@Injectable()
export class PurchaseService extends BaseService {
  constructor() {
    super()
  }

  /** 作品数据访问对象 */
  get work() {
    return this.prisma.work
  }

  /** 章节数据访问对象 */
  get workChapter() {
    return this.prisma.workChapter
  }

  /** 用户数据访问对象 */
  get appUser() {
    return this.prisma.appUser
  }

  /** 用户购买记录数据访问对象 */
  get userPurchaseRecord() {
    return this.prisma.userPurchaseRecord
  }

  /**
   * 购买目标（作品或章节）
   * @param dto 购买记录DTO
   * @returns 购买记录
   * @throws BadRequestException 当目标不存在、禁止购买、已购买或支付失败时抛出
   */
  async purchaseTarget(dto: PurchaseTargetDto) {
    const { targetType, targetId, userId, price, paymentMethod, outTradeNo } = dto

    // 根据目标类型校验购买权限并获取价格
    if (
      targetType === PurchaseTargetTypeEnum.COMIC_CHAPTER ||
      targetType === PurchaseTargetTypeEnum.NOVEL_CHAPTER
    ) {
      await this.validateChapterPurchasePermission(targetId, userId)
    } else if (
      targetType === PurchaseTargetTypeEnum.COMIC ||
      targetType === PurchaseTargetTypeEnum.NOVEL
    ) {
      await this.validateWorkPurchasePermission(targetId, userId)
    }

    // 检查是否已购买（幂等性）
    const existingPurchase = await this.userPurchaseRecord.findFirst({
      where: {
        targetType,
        targetId,
        userId,
        status: PurchaseStatusEnum.SUCCESS,
      },
    })
    if (existingPurchase) {
      return existingPurchase
    }

    // 使用事务保证一致性：扣除积分/余额 + 创建购买记录 + 增加购买次数
    return this.prisma.$transaction(async (tx) => {
      // 处理支付
      await this.processPayment(tx, userId, price, paymentMethod)

      // 创建购买记录
      const record = await tx.userPurchaseRecord.create({
        data: {
          targetType,
          targetId,
          userId,
          price,
          status: PurchaseStatusEnum.SUCCESS,
          paymentMethod,
          outTradeNo,
        },
      })

      // 更新购买计数
      await this.updatePurchaseCount(tx, targetType, targetId, 1)

      return record
    })
  }

  /**
   * 校验章节购买权限
   * @param chapterId 章节ID
   * @param userId 用户ID
   * @throws BadRequestException 当章节不存在或权限不足时抛出
   */
  private async validateChapterPurchasePermission(chapterId: number, userId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      include: {
        requiredReadLevel: true,
      },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    await this.validatePurchasePermission(
      {
        purchaseRule: chapter.readRule,
        price: chapter.price,
        requiredPurchaseLevelId: chapter.requiredReadLevelId,
        requiredPurchaseLevel: chapter.requiredReadLevel,
      },
      userId,
      '章节',
    )
  }

  /**
   * 校验作品购买权限
   * @param workId 作品ID
   * @param userId 用户ID
   * @throws BadRequestException 当作品不存在或权限不足时抛出
   */
  private async validateWorkPurchasePermission(workId: number, userId: number) {
    const work = await this.work.findUnique({
      where: { id: workId },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    // 作品购买暂时只校验价格
    if (!work.price || work.price <= 0) {
      throw new BadRequestException('该作品暂不支持购买')
    }
  }

  /**
   * 校验购买权限（通用方法）
   * @param config 购买权限配置
   * @param userId 用户ID
   * @param targetName 目标名称（用于错误提示）
   * @throws BadRequestException 当禁止购买或权限不足时抛出
   */
  private async validatePurchasePermission(
    config: PurchasePermissionConfig,
    userId: number,
    targetName: string,
  ) {
    // 检查是否禁止购买
    if (config.purchaseRule === 0) {
      throw new BadRequestException(`该${targetName}禁止购买`)
    }

    // 检查价格是否有效
    if (!config.price || config.price <= 0) {
      throw new BadRequestException(`该${targetName}暂不支持购买`)
    }

    // 查询用户信息
    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }
  }

  /**
   * 处理支付
   * @param tx Prisma事务客户端
   * @param userId 用户ID
   * @param price 支付金额
   * @param paymentMethod 支付方式
   * @throws BadRequestException 当余额不足时抛出
   */
  private async processPayment(
    tx: any,
    userId: number,
    price: number,
    paymentMethod: PaymentMethodEnum,
  ) {
    // 积分支付
    if (paymentMethod === PaymentMethodEnum.POINTS) {
      const user = await tx.appUser.findUnique({
        where: { id: userId },
        select: { points: true },
      })
      if (!user || user.points < price) {
        throw new BadRequestException('积分不足')
      }
      await tx.appUser.update({
        where: { id: userId },
        data: { points: { decrement: price } },
      })
    }

    // 余额支付
    if (paymentMethod === PaymentMethodEnum.BALANCE) {
      const user = await tx.appUser.findUnique({
        where: { id: userId },
        select: { balance: true },
      })
      if (!user || user.balance < price) {
        throw new BadRequestException('余额不足')
      }
      await tx.appUser.update({
        where: { id: userId },
        data: { balance: { decrement: price } },
      })
    }

    // 支付宝/微信支付 - 预留接口
    if (
      paymentMethod === PaymentMethodEnum.ALIPAY ||
      paymentMethod === PaymentMethodEnum.WECHAT
    ) {
      // TODO: 第三方支付集成
      throw new BadRequestException('暂不支持该支付方式')
    }
  }

  /**
   * 处理退款
   * @param tx Prisma事务客户端
   * @param userId 用户ID
   * @param price 退款金额
   * @param paymentMethod 原支付方式
   */
  private async processRefund(
    tx: any,
    userId: number,
    price: number,
    paymentMethod: PaymentMethodEnum,
  ) {
    // 积分退款
    if (paymentMethod === PaymentMethodEnum.POINTS) {
      await tx.appUser.update({
        where: { id: userId },
        data: { points: { increment: price } },
      })
    }

    // 余额退款
    if (paymentMethod === PaymentMethodEnum.BALANCE) {
      await tx.appUser.update({
        where: { id: userId },
        data: { balance: { increment: price } },
      })
    }

    // 支付宝/微信退款 - 预留接口
    if (
      paymentMethod === PaymentMethodEnum.ALIPAY ||
      paymentMethod === PaymentMethodEnum.WECHAT
    ) {
      // TODO: 第三方支付退款集成
    }
  }

  /**
   * 更新购买计数
   * @param tx Prisma事务客户端
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param increment 增量（正数增加，负数减少）
   */
  private async updatePurchaseCount(
    tx: any,
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
    increment: number,
  ) {
    if (
      targetType === PurchaseTargetTypeEnum.COMIC_CHAPTER ||
      targetType === PurchaseTargetTypeEnum.NOVEL_CHAPTER
    ) {
      await tx.workChapter.update({
        where: { id: targetId },
        data: { purchaseCount: { increment } },
      })
    } else if (
      targetType === PurchaseTargetTypeEnum.COMIC ||
      targetType === PurchaseTargetTypeEnum.NOVEL
    ) {
      await tx.work.update({
        where: { id: targetId },
        data: { purchaseCount: { increment } },
      })
    }
  }

  /**
   * 检查用户是否已购买指定目标
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param userId 用户ID
   * @returns 是否已购买
   */
  async checkPurchaseStatus(
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
    userId: number,
  ) {
    const purchase = await this.userPurchaseRecord.findFirst({
      where: {
        targetType,
        targetId,
        userId,
        status: PurchaseStatusEnum.SUCCESS,
      },
    })
    return !!purchase
  }

  /**
   * 批量检查用户购买状态
   * @param targetType 目标类型
   * @param targetIds 目标ID数组
   * @param userId 用户ID
   * @returns Map<targetId, 是否已购买>
   */
  async checkStatusBatch(
    targetType: PurchaseTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map()
    }

    // 查询已购买的目标ID
    const purchases = await this.userPurchaseRecord.findMany({
      where: {
        targetType,
        targetId: { in: targetIds },
        userId,
        status: PurchaseStatusEnum.SUCCESS,
      },
      select: {
        targetId: true,
      },
    })

    // 构建结果Map
    const purchasedIds = new Set(purchases.map((p) => p.targetId))
    const result = new Map<number, boolean>()

    for (const id of targetIds) {
      result.set(id, purchasedIds.has(id))
    }

    return result
  }

  /**
   * 获取用户购买列表
   * @param dto 查询DTO
   * @returns 分页购买记录列表
   */
  async getUserPurchases(dto: QueryUserPurchaseRecordDto) {
    return this.prisma.userPurchaseRecord.findPagination({
      where: dto,
    })
  }

  /**
   * 退款
   * @param dto 退款请求DTO
   * @returns 更新后的购买记录
   * @throws BadRequestException 当购买记录不存在、不属于当前用户或状态不允许退款时抛出
   */
  async refundPurchase(dto: RefundPurchaseDto) {
    const { purchaseId, userId, reason } = dto

    // 查询购买记录
    const purchase = await this.userPurchaseRecord.findUnique({
      where: { id: purchaseId },
    })

    if (!purchase) {
      throw new BadRequestException('购买记录不存在')
    }

    // 校验记录归属
    if (purchase.userId !== userId) {
      throw new BadRequestException('无权操作此记录')
    }

    // 校验状态
    if (purchase.status !== PurchaseStatusEnum.SUCCESS) {
      throw new BadRequestException('该记录不支持退款')
    }

    // 使用事务保证一致性：更新记录状态 + 返还积分/余额 + 减少购买次数
    return this.prisma.$transaction(async (tx) => {
      // 更新记录状态
      const updated = await tx.userPurchaseRecord.update({
        where: { id: purchaseId },
        data: {
          status: PurchaseStatusEnum.REFUNDED,
        },
      })

      // 返还积分/余额
      await this.processRefund(tx, userId, purchase.price, purchase.paymentMethod)

      // 更新购买计数
      await this.updatePurchaseCount(tx, purchase.targetType, purchase.targetId, -1)

      return updated
    })
  }
}
```

### 2.5 购买流程

```
用户发起购买请求
       ↓
  校验目标是否存在
       ↓
  校验是否已购买（幂等性）
       ↓
  获取目标价格信息
       ↓
  校验用户支付能力
       ↓
  ┌─────────────────┐
  │    事务开始     │
  ├─────────────────┤
  │ 1. 扣除积分/余额 │
  │ 2. 创建购买记录 │
  │ 3. 更新购买计数 │
  ├─────────────────┤
  │    事务提交     │
  └─────────────────┘
       ↓
    返回购买记录
```

### 2.6 退款流程

```
用户发起退款请求
       ↓
  校验购买记录存在
       ↓
  校验记录归属用户
       ↓
  校验记录状态（仅成功状态可退款）
       ↓
  ┌─────────────────┐
  │    事务开始     │
  ├─────────────────┤
  │ 1. 更新记录状态 │
  │ 2. 返还积分/余额 │
  │ 3. 更新购买计数 │
  ├─────────────────┤
  │    事务提交     │
  └─────────────────┘
       ↓
    返回更新记录
```

## 3. 数据模型变更

### 3.1 AppUser 模型变更

```prisma
// 修改前
model AppUser {
  points     Int @default(0)
  // ...
}

// 修改后
model AppUser {
  points     Int @default(0) @map("points")        // 积分（保持不变）
  balance    Int @default(0) @map("balance")       // 余额（新增）
  // ...
}
```

### 3.2 WorkChapter 模型变更

```prisma
// 修改前
model WorkChapter {
  readPoints     Int? @default(0) @map("read_points")
  // ...
}

// 修改后
model WorkChapter {
  price     Int @default(0) @map("price")        // 价格（原 readPoints）
  // ...
}
```

### 3.3 Work 模型变更

```prisma
// 修改前
model Work {
  // 无价格字段
  // ...
}

// 修改后
model Work {
  price     Int @default(0) @map("price")        // 价格（新增）
  // ...
}
```

## 4. 技术约束

### 4.1 与现有系统集成

1. **download 模块**：主要参考 download 模块的结构和实现方式
2. **Prisma**：使用现有的 UserPurchaseRecord 模型
3. **BaseService**：继承 `@libs/base/database` 的 BaseService

### 4.2 数据一致性

1. 购买操作使用事务保证原子性
2. 购买计数与购买记录同步更新
3. 积分/余额扣除与购买记录创建同步

### 4.3 幂等性保证

1. 同一用户对同一目标只能有一条成功购买记录（数据库唯一约束）
2. 重复购买请求返回已存在的购买记录

## 5. 第三方支付预留接口

```typescript
/** 支付服务接口（预留） */
interface IPaymentService {
  /** 创建支付订单 */
  createOrder(params: CreateOrderParams): Promise<PaymentOrder>
  
  /** 查询支付状态 */
  queryOrder(outTradeNo: string): Promise<PaymentStatus>
  
  /** 处理支付回调 */
  handleCallback(data: CallbackData): Promise<PaymentResult>
}

/** 支付宝支付服务 */
class AlipayService implements IPaymentService { }

/** 微信支付服务 */
class WechatPayService implements IPaymentService { }
```

## 6. 接口契约

### 6.1 购买接口

```typescript
// 请求
POST /purchase
{
  "targetType": 3,        // 漫画章节
  "targetId": 123,
  "userId": 1,
  "price": 100,
  "paymentMethod": 1      // 积分支付
}

// 响应
{
  "id": 1,
  "targetType": 3,
  "targetId": 123,
  "userId": 1,
  "price": 100,
  "status": 1,
  "paymentMethod": 1,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### 6.2 检查购买状态接口

```typescript
// 请求
GET /purchase/status?targetType=3&targetId=123&userId=1

// 响应
{
  "purchased": true
}
```

### 6.3 批量检查接口

```typescript
// 请求
POST /purchase/status/batch
{
  "targetType": 3,
  "targetIds": [1, 2, 3],
  "userId": 1
}

// 响应
{
  "1": true,
  "2": false,
  "3": true
}
```

### 6.4 退款接口

```typescript
// 请求
POST /purchase/refund
{
  "purchaseId": 1,
  "userId": 1,
  "reason": "不想要了"
}

// 响应
{
  "id": 1,
  "status": 4,  // 已退款
  "updatedAt": "2024-01-02T00:00:00Z"
}
```

## 7. 任务边界

### 7.1 本次任务范围

1. 创建 purchase 模块（service、constant、dto、module）
2. 更新 Prisma 模型（AppUser、Work、WorkChapter 字段变更）
3. 实现购买核心逻辑
4. 实现退款核心逻辑
5. 更新 interaction 模块导出

### 7.2 不在本次范围

1. 第三方支付实际集成（仅预留接口）
2. 前端页面开发
3. 管理后台功能
4. 购买相关的统计分析功能
