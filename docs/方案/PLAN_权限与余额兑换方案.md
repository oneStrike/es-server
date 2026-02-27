# 权限与余额/兑换方案（详细）

## 1. 目标与约束
- 同一作品/章节支持多种方式并存：余额购买与积分兑换
- 积分用于兑换，余额用于购买
- 章节权限可继承作品权限，不额外增加继承字段
- 权限字段命名调整为 viewRule（数字枚举）

## 2. 权限与价格规则
### 2.1 规则枚举（数字）
- -1：INHERIT（继承作品）
- 0：ALL（所有人）
- 1：LOGGED_IN（登录用户）
- 2：MEMBER（会员）
- 3：POINTS（需积分/兑换）

### 2.2 章节继承策略
- 章节 viewRule = INHERIT 时，继承作品的：
  - viewRule
  - requiredViewLevelId
  - chapterPrice（章节余额价）
  - chapterExchangePoints（章节兑换积分）
  - canExchange（是否允许兑换）
- 章节 viewRule ≠ INHERIT 时，使用章节自身字段

### 2.3 购买与兑换
- 购买：余额支付，校验 price > 0
- 兑换：积分支付，校验 canExchange = true 且 exchangePoints > 0
- 二者可同时开启：price > 0 且 canExchange = true

## 3. 数据模型调整
### 3.1 作品（Work）
- 新增字段
  - viewRule Int（默认 0）
  - requiredViewLevelId Int?
  - chapterPrice Int（默认 0）
  - chapterExchangePoints Int（默认 0）
  - canExchange Boolean（默认 false）
- 保持现有字段：price（作品余额购买价）

### 3.2 章节（WorkChapter）
- 重命名字段
  - readRule -> viewRule
  - requiredReadLevelId -> requiredViewLevelId
- 新增字段
  - exchangePoints Int（默认 0）
  - canExchange Boolean（默认 false）
- 章节 viewRule 允许 INHERIT（-1）

### 3.3 用户余额
- AppUser 新增 balance 字段（建议 Decimal 或 Int，按现有金额存储风格选择）
- 新增用户余额流水表 UserBalanceRecord

### 3.4 积分记录复用
- 复用现有积分记录表
- 新增业务类型 EXCHANGE
- 增加关联字段（targetType/targetId/exchangeId）用于追溯兑换对象

## 4. 服务与逻辑改造
### 4.1 权限解析器
- 新增“有效权限解析”工具方法
- 输入章节或作品，输出实际生效的 viewRule/price/exchangePoints/canExchange/requiredViewLevelId

### 4.2 购买流程（余额）
- 校验有效 viewRule
- 校验余额与 price
- 事务：扣减余额 + 记录购买 + 更新计数 + 写余额流水

### 4.3 兑换流程（积分）
- 校验有效 viewRule（或单独兑换规则，按业务可选）
- 校验 canExchange 与 exchangePoints
- 事务：扣减积分 + 记录兑换 + 写积分流水

### 4.4 下载权限
- 先校验下载规则，再校验有效 viewRule
- 作品与章节统一走“有效权限解析”

## 5. 接口与 DTO 调整
- 作品/章节 DTO
  - viewRule（含 INHERIT）
  - requiredViewLevelId
  - price（余额购买价）
  - exchangePoints（积分兑换价）
  - canExchange
- 余额相关接口
  - 查询余额
  - 余额流水
- 兑换相关接口
  - 兑换目标
  - 兑换记录列表

## 6. 迁移策略
- Prisma 迁移新增字段
- 历史章节 viewRule 默认保持原值
- 新建章节默认 viewRule = INHERIT

## 7. 验收清单
- 购买仅扣余额，积分不参与购买
- 兑换仅扣积分，余额不参与兑换
- 章节 INHERIT 正确继承作品权限与价格
- canExchange 与 exchangePoints 联动控制兑换可用性
- lint 与 type-check 通过
