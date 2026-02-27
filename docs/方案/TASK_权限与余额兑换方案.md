# 任务清单（原子化）

## A. 数据模型与迁移
### A1. Work 模型字段新增
- 文件：prisma/models/work/work.prisma
- 变更：新增字段
  - viewRule Int 默认 0
  - requiredViewLevelId Int?
  - chapterPrice Int 默认 0
  - chapterExchangePoints Int 默认 0
  - canExchange Boolean 默认 false
- 操作类型：改

### A2. WorkChapter 模型字段重命名与新增
- 文件：prisma/models/work/work-chapter.prisma
- 变更：
  - readRule -> viewRule
  - requiredReadLevelId -> requiredViewLevelId
  - 新增 exchangePoints Int 默认 0
  - 新增 canExchange Boolean 默认 false
- 操作类型：改

### A3. AppUser 余额字段新增
- 文件：prisma/models/app/app-user.prisma
- 变更：新增 balance 字段（Int 或 Decimal，按现有金额风格）
- 操作类型：改

### A4. 余额流水表新增
- 文件：prisma/models/app/user-balance-record.prisma
- 变更：新增用户余额流水表（充值/扣减/退款/调整等）
- 操作类型：增

### A5. 积分记录表复用扩展
- 文件：prisma/models/app/user-point-record.prisma
- 变更：新增业务类型 EXCHANGE，补充关联字段（targetType/targetId/exchangeId）
- 操作类型：改

### A6. Prisma 迁移
- 文件：prisma/migrations/*
- 变更：生成迁移脚本与字段默认值
- 操作类型：增

## B. 枚举与常量
### B1. 权限枚举扩展
- 文件：libs/base/src/constant/base.constant.ts
- 变更：WorkViewPermissionEnum 增加 INHERIT = -1
- 操作类型：改

### B2. 兑换业务枚举
- 文件：libs/user/src/point/point.constant.ts
- 变更：新增 EXCHANGE 业务类型（或对应业务枚举）
- 操作类型：改

## C. DTO 与接口参数
### C1. 作品 DTO 字段新增
- 文件：libs/content/src/work/core/dto/work.dto.ts
- 变更：新增 viewRule、requiredViewLevelId、chapterPrice、chapterExchangePoints、canExchange
- 操作类型：改

### C2. 章节 DTO 字段改名与新增
- 文件：libs/content/src/work/chapter/dto/work-chapter.dto.ts
- 变更：readRule -> viewRule、requiredReadLevelId -> requiredViewLevelId；新增 exchangePoints、canExchange
- 操作类型：改

### C3. 余额与兑换 DTO
- 文件：libs/user/src/point/dto/point-record.dto.ts
- 文件：libs/user/src/point/dto/point-rule.dto.ts
- 文件：libs/user/src/point/dto/point-exchange.dto.ts（若不存在则新增）
- 变更：补充兑换请求/响应字段
- 操作类型：改/增

## D. 服务逻辑
### D0. 用户权限服务抽离
- 文件：libs/user/src/permission/permission.service.ts
- 文件：libs/user/src/permission/permission.module.ts
- 文件：libs/user/src/permission/index.ts
- 变更：新增用户权限服务，封装 viewRule/等级/余额/积分校验
- 操作类型：增

### D1. 权限解析器
- 文件：libs/content/src/work/chapter/work-chapter.service.ts 或 libs/content/src/work/core/work.service.ts
- 变更：新增有效权限解析方法（输出 viewRule/price/exchangePoints/canExchange/requiredViewLevelId）
- 操作类型：改

### D2. 章节阅读/购买/下载使用解析器
- 文件：libs/content/src/work/chapter/work-chapter.service.ts
- 变更：阅读/购买/下载流程统一走解析器与权限服务
- 操作类型：改

### D3. 作品权限校验补全
- 文件：libs/content/src/work/core/work.service.ts
- 变更：增加作品层 viewRule/price/等级校验，复用权限服务
- 操作类型：改

### D4. 余额购买流程
- 文件：libs/interaction/src/purchase/purchase.service.ts
- 变更：使用余额支付，扣减余额并写余额流水，复用权限服务
- 操作类型：改

### D5. 积分兑换流程
- 文件：libs/interaction/src/purchase/purchase.service.ts 或新增 exchange.service.ts
- 变更：新增兑换逻辑，扣减积分并写积分流水，复用权限服务
- 操作类型：改/增

### D6. 下载权限校验调整
- 文件：libs/interaction/src/download/download.service.ts
- 变更：先校验下载规则，再校验有效 viewRule，复用权限服务
- 操作类型：改

## E. API 模块
### E1. 余额查询与流水
- 文件：apps/app-api/src/modules/user/user.controller.ts
- 文件：libs/user/src/point/point.service.ts（或新增 balance.service.ts）
- 变更：新增余额查询、余额流水接口
- 操作类型：改/增

### E2. 兑换接口
- 文件：apps/app-api/src/modules/work/work.controller.ts 或新增兑换 controller
- 变更：新增兑换目标接口与兑换记录列表
- 操作类型：改/增

## F. 数据初始化与规则
### F1. 积分规则种子
- 文件：prisma/seed/modules/work/work-growth-rule.ts
- 变更：补充兑换相关积分规则
- 操作类型：改

## G. 测试与验证
### G1. 测试用例
- 文件：libs/content/**/__tests__/*
- 文件：libs/interaction/**/__tests__/*
- 变更：新增购买/兑换/继承场景测试
- 操作类型：增

### G2. 质量门控
- 运行 lint 与 type-check

## H. 影响文件清单（增删改查汇总）
- 增：prisma/models/app/user-balance-record.prisma
- 增：prisma/migrations/*
- 增：兑换相关 DTO/Service（若单独拆分）
- 增：libs/user/src/permission/*
- 改：prisma/models/work/work.prisma
- 改：prisma/models/work/work-chapter.prisma
- 改：prisma/models/app/app-user.prisma
- 改：prisma/models/app/user-point-record.prisma
- 改：libs/base/src/constant/base.constant.ts
- 改：libs/content/src/work/core/dto/work.dto.ts
- 改：libs/content/src/work/chapter/dto/work-chapter.dto.ts
- 改：libs/content/src/work/chapter/work-chapter.service.ts
- 改：libs/content/src/work/core/work.service.ts
- 改：libs/interaction/src/purchase/purchase.service.ts
- 改：libs/interaction/src/download/download.service.ts
- 改：apps/app-api/src/modules/**/*
