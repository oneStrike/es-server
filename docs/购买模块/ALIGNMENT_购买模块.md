# 购买模块 - 对齐文档

## 1. 原始需求

按照下载记录模块设计一个购买模块。

## 2. 项目上下文分析

### 2.1 现有下载模块架构

下载模块位于 `libs/interaction/src/download/`，包含以下文件：

| 文件 | 说明 |
|------|------|
| `download.service.ts` | 核心服务，处理下载权限校验、记录创建、统计更新 |
| `download.constant.ts` | 目标类型枚举（漫画、小说、章节） |
| `download.dto.ts` | DTO 定义（基础记录、查询参数） |
| `download.module.ts` | NestJS 模块定义 |
| `index.ts` | 导出文件 |

### 2.2 下载模块核心功能

1. **权限校验**：支持多种权限模式
   - 禁止下载 (downloadRule = 0)
   - 所有人可下载 (downloadRule = 1)
   - 会员可下载 (downloadRule = 2)，支持指定会员等级
   - 积分可下载 (downloadRule = 3)

2. **下载操作**：
   - 创建下载记录
   - 增加下载计数（事务保证一致性）

3. **查询功能**：
   - 批量检查下载状态
   - 获取用户下载列表

### 2.3 现有购买相关数据模型

项目中已存在两个购买相关的模型：

#### UserPurchaseRecord（用户购买记录表）
```prisma
model UserPurchaseRecord {
  id            Int      @id @default(autoincrement())
  targetType    Int      // 目标类型 1=漫画, 2=小说, 3=漫画章节, 4=小说章节
  targetId      Int      // 目标ID
  userId        Int      // 用户ID
  price         Int      // 购买价格
  status        Int      // 购买状态（1=成功, 2=失败, 3=退款中, 4=已退款）
  paymentMethod Int      // 支付方式（1=余额, 2=支付宝, 3=微信, 4=积分兑换）
  outTradeNo    String?  // 第三方支付订单号
  createdAt     DateTime
  updatedAt     DateTime
}
```

#### WorkChapterPurchase（章节购买记录）
```prisma
model WorkChapterPurchase {
  id        Int      @id @default(autoincrement())
  chapterId Int      // 章节ID
  userId    Int      // 用户ID
  createdAt DateTime
}
```

### 2.4 作品/章节购买相关字段

**WorkChapter（章节）**：
- `readRule`: 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买）
- `readPoints`: 阅读所需积分
- `requiredReadLevelId`: 允许查看的会员等级ID
- `purchaseCount`: 购买次数

**Work（作品）**：暂无购买相关字段（作品级别购买可能需要扩展）

**AppUser（用户）**：
- `points`: 论坛积分
- `levelId`: 会员等级

## 3. 需求理解

### 3.1 购买模块与下载模块的对比

| 维度 | 下载模块 | 购买模块 |
|------|----------|----------|
| 核心操作 | 记录下载行为 | 记录购买行为 + 扣款 |
| 权限校验 | 下载权限 | 购买权限 + 支付能力 |
| 数据模型 | UserDownloadRecord | UserPurchaseRecord / WorkChapterPurchase |
| 是否可逆 | 不可取消 | 支持退款 |
| 统计字段 | downloadCount | purchaseCount |

### 3.2 关键差异点

1. **支付流程**：购买需要处理支付逻辑（积分扣除、第三方支付）
2. **价格字段**：购买需要记录实际支付价格
3. **状态管理**：购买有成功、失败、退款等状态
4. **幂等性**：同一用户对同一目标只能购买一次

## 4. 疑问澄清

### 4.1 需要确认的问题

1. **购买目标范围**：
   - 仅支持章节购买？
   - 还是支持作品整本购买？
   - 或者两者都支持？

2. **支付方式**：
   - 仅支持积分购买？
   - 还是支持多种支付方式（余额、支付宝、微信）？

3. **与现有 WorkChapterPurchase 的关系**：
   - 是否复用 WorkChapterPurchase？
   - 还是统一使用 UserPurchaseRecord？
   - 两个表是否需要合并或关联？

4. **购买后的权益**：
   - 购买章节后是否永久可读？
   - 是否需要支持购买记录查询？

5. **退款功能**：
   - 是否需要支持退款？
   - 退款后积分是否返还？

## 5. 初步方案建议

### 5.1 推荐方案

基于现有架构，建议采用以下设计：

1. **统一使用 UserPurchaseRecord**：
   - 该表设计更完善，支持多种目标类型
   - 支持价格、状态、支付方式等完整信息

2. **购买服务核心功能**：
   - `purchaseTarget()`: 购买目标（作品/章节）
   - `checkPurchaseStatus()`: 检查购买状态
   - `checkStatusBatch()`: 批量检查购买状态
   - `getUserPurchases()`: 获取用户购买列表
   - `refundPurchase()`: 退款（可选）

3. **权限校验逻辑**：
   - 参考 DownloadService 的权限校验模式
   - 增加：检查用户积分/余额是否足够
   - 增加：支付扣款逻辑

4. **模块结构**：
   ```
   libs/interaction/src/purchase/
   ├── purchase.service.ts    # 核心服务
   ├── purchase.constant.ts   # 常量定义
   ├── purchase.dto.ts        # DTO 定义
   ├── purchase.module.ts     # 模块定义
   └── index.ts               # 导出
   ```

### 5.2 待确认事项

请确认以上疑问点，以便进一步完善设计方案。
