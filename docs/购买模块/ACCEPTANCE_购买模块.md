# 购买模块 - 验收文档

## 1. 完成情况

### 1.1 Prisma 模型变更

| 模型 | 变更内容 | 状态 |
|------|----------|------|
| AppUser | 新增 `balance` 余额字段 | ✅ |
| Work | 新增 `price`、`purchaseCount` 字段 | ✅ |
| WorkChapter | `readPoints` → `price` | ✅ |

### 1.2 新增文件

| 文件路径 | 说明 | 状态 |
|----------|------|------|
| `libs/interaction/src/purchase/purchase.service.ts` | 核心服务 | ✅ |
| `libs/interaction/src/purchase/purchase.constant.ts` | 常量定义 | ✅ |
| `libs/interaction/src/purchase/purchase.dto.ts` | DTO 定义 | ✅ |
| `libs/interaction/src/purchase/purchase.module.ts` | 模块定义 | ✅ |
| `libs/interaction/src/purchase/index.ts` | 导出文件 | ✅ |

### 1.3 修改文件

| 文件路径 | 变更内容 | 状态 |
|----------|----------|------|
| `libs/interaction/src/index.ts` | 新增 purchase 模块导出 | ✅ |
| `libs/interaction/src/interaction.module.ts` | 新增 PurchaseModule | ✅ |
| `libs/interaction/src/interaction.constant.ts` | 新增购买相关常量 | ✅ |
| `libs/interaction/src/download/download.service.ts` | 修改方法签名 | ✅ |
| `libs/content/src/work/chapter/work-chapter.service.ts` | 适配字段变更 | ✅ |

## 2. 功能验收

### 2.1 核心功能

| 功能 | 方法 | 状态 |
|------|------|------|
| 购买目标 | `purchaseTarget()` | ✅ |
| 检查购买状态 | `checkPurchaseStatus()` | ✅ |
| 批量检查购买状态 | `checkStatusBatch()` | ✅ |
| 获取用户购买列表 | `getUserPurchases()` | ✅ |
| 退款 | `refundPurchase()` | ✅ |

### 2.2 支付方式

| 支付方式 | 枚举值 | 状态 |
|----------|--------|------|
| 积分 | POINTS = 1 | ✅ 已实现 |
| 余额 | BALANCE = 2 | ✅ 已实现 |
| 支付宝 | ALIPAY = 3 | ⏳ 预留接口 |
| 微信 | WECHAT = 4 | ⏳ 预留接口 |

### 2.3 购买目标类型

| 目标类型 | 枚举值 | 状态 |
|----------|--------|------|
| 漫画 | COMIC = 1 | ✅ |
| 小说 | NOVEL = 2 | ✅ |
| 漫画章节 | COMIC_CHAPTER = 3 | ✅ |
| 小说章节 | NOVEL_CHAPTER = 4 | ✅ |

## 3. 编译验证

```
> tsc --noEmit -p tsconfig.build.json
```

✅ 编译通过，无错误

## 4. 待办事项

### 4.1 数据库迁移

需要执行 Prisma 迁移命令：

```bash
pnpm prisma migrate dev --name add_purchase_module
```

### 4.2 第三方支付集成

支付宝和微信支付接口已预留，待后续集成：

- `PaymentMethodEnum.ALIPAY`
- `PaymentMethodEnum.WECHAT`

### 4.3 Work 模型扩展（可选）

如果需要作品级别的购买权限控制，可考虑添加：

- `purchaseRule`: 购买规则
- `requiredPurchaseLevelId`: 要求的会员等级
