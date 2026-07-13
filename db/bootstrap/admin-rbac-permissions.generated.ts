import type { AdminReferencePermission } from '@libs/identity/admin-rbac.reference'

/**
 * 由 scripts/generate-admin-rbac-reference-permissions.ts 从 controller 装饰器生成。
 * 禁止手工编辑；修改 AdminPermission 后必须重新生成并提交该文件。
 */
export const ADMIN_REFERENCE_PERMISSIONS = [
  {
    code: 'ad:reward:credential:option:list',
    groupCode: 'ad:reward',
    name: '查询广告验签密钥选项',
  },
  {
    code: 'ad:reward:provider:create',
    groupCode: 'ad:reward',
    name: '创建广告 provider 配置',
  },
  {
    code: 'ad:reward:provider:page',
    groupCode: 'ad:reward',
    name: '分页查询广告 provider 配置',
  },
  {
    code: 'ad:reward:provider:update',
    groupCode: 'ad:reward',
    name: '更新广告 provider 配置',
  },
  {
    code: 'ad:reward:provider:update:status',
    groupCode: 'ad:reward',
    name: '更新广告 provider 启用状态',
  },
  {
    code: 'ad:reward:record:detail',
    groupCode: 'ad:reward',
    name: '查询广告奖励记录详情',
  },
  {
    code: 'ad:reward:record:page',
    groupCode: 'ad:reward',
    name: '分页查询广告奖励记录',
  },
  {
    code: 'ad:reward:record:reconcile:page',
    groupCode: 'ad:reward',
    name: '分页查询广告奖励和内容权益对账视图',
  },
  {
    code: 'ad:reward:record:revoke',
    groupCode: 'ad:reward',
    name: '撤销广告奖励记录',
  },
  {
    code: 'agreement:create',
    groupCode: 'agreement',
    name: '创建协议',
  },
  {
    code: 'agreement:detail',
    groupCode: 'agreement',
    name: '获取协议详情',
  },
  {
    code: 'agreement:page',
    groupCode: 'agreement',
    name: '查询协议分页',
  },
  {
    code: 'agreement:update',
    groupCode: 'agreement',
    name: '更新协议',
  },
  {
    code: 'agreement:update:status',
    groupCode: 'agreement',
    name: '更新协议发布状态',
  },
  {
    code: 'announcement:create',
    groupCode: 'announcement',
    name: '创建公告',
  },
  {
    code: 'announcement:delete',
    groupCode: 'announcement',
    name: '下线公告',
  },
  {
    code: 'announcement:detail',
    groupCode: 'announcement',
    name: '公告详情',
  },
  {
    code: 'announcement:page',
    groupCode: 'announcement',
    name: '分页查询公告列表',
  },
  {
    code: 'announcement:retry:fanout',
    groupCode: 'announcement',
    name: '重试公告消息中心通知',
  },
  {
    code: 'announcement:update',
    groupCode: 'announcement',
    name: '更新公告',
  },
  {
    code: 'announcement:update:status',
    groupCode: 'announcement',
    name: '更新公告状态',
  },
  {
    code: 'app:config:active',
    groupCode: 'app:config',
    name: '获取最新应用配置',
  },
  {
    code: 'app:config:update',
    groupCode: 'app:config',
    name: '更新应用配置',
  },
  {
    code: 'app:page:code:detail',
    groupCode: 'app:page',
    name: '根据页面编码查询页面配置详情',
  },
  {
    code: 'app:page:create',
    groupCode: 'app:page',
    name: '创建页面配置',
  },
  {
    code: 'app:page:delete',
    groupCode: 'app:page',
    name: '批量下线页面配置',
  },
  {
    code: 'app:page:detail',
    groupCode: 'app:page',
    name: '根据ID查询页面配置详情',
  },
  {
    code: 'app:page:page',
    groupCode: 'app:page',
    name: '分页查询页面配置列表',
  },
  {
    code: 'app:page:update',
    groupCode: 'app:page',
    name: '更新页面配置',
  },
  {
    code: 'app:update:create',
    groupCode: 'app:update',
    name: '创建更新版本草稿',
  },
  {
    code: 'app:update:detail',
    groupCode: 'app:update',
    name: '获取更新版本详情',
  },
  {
    code: 'app:update:page',
    groupCode: 'app:update',
    name: '分页查询更新版本列表',
  },
  {
    code: 'app:update:update',
    groupCode: 'app:update',
    name: '更新更新版本草稿',
  },
  {
    code: 'app:update:update:status',
    groupCode: 'app:update',
    name: '更新更新版本发布状态',
  },
  {
    code: 'app:users:badges:assign',
    groupCode: 'app:users',
    name: '为 APP 用户分配徽章',
  },
  {
    code: 'app:users:badges:page',
    groupCode: 'app:users',
    name: '分页查询 APP 用户徽章',
  },
  {
    code: 'app:users:badges:revoke',
    groupCode: 'app:users',
    name: '撤销 APP 用户徽章',
  },
  {
    code: 'app:users:create',
    groupCode: 'app:users',
    name: '新建 APP 用户',
  },
  {
    code: 'app:users:delete',
    groupCode: 'app:users',
    name: '删除 APP 用户',
  },
  {
    code: 'app:users:detail',
    groupCode: 'app:users',
    name: '获取 APP 用户详情',
  },
  {
    code: 'app:users:experience:grant',
    groupCode: 'app:users',
    name: '手动增加 APP 用户经验',
  },
  {
    code: 'app:users:experience:record:page',
    groupCode: 'app:users',
    name: '分页查询 APP 用户经验记录',
  },
  {
    code: 'app:users:experience:stats',
    groupCode: 'app:users',
    name: '获取 APP 用户经验统计',
  },
  {
    code: 'app:users:growth:record:page',
    groupCode: 'app:users',
    name: '分页查询 APP 用户混合成长流水',
  },
  {
    code: 'app:users:page',
    groupCode: 'app:users',
    name: '分页查询 APP 用户列表',
  },
  {
    code: 'app:users:password:reset',
    groupCode: 'app:users',
    name: '重置 APP 用户密码',
  },
  {
    code: 'app:users:points:consume',
    groupCode: 'app:users',
    name: '手动扣减 APP 用户积分',
  },
  {
    code: 'app:users:points:grant',
    groupCode: 'app:users',
    name: '手动增加 APP 用户积分',
  },
  {
    code: 'app:users:points:record:page',
    groupCode: 'app:users',
    name: '分页查询 APP 用户积分记录',
  },
  {
    code: 'app:users:points:stats',
    groupCode: 'app:users',
    name: '获取 APP 用户积分统计',
  },
  {
    code: 'app:users:profile:update',
    groupCode: 'app:users',
    name: '更新 APP 用户资料',
  },
  {
    code: 'app:users:rebuild:follow:count',
    groupCode: 'app:users',
    name: '重建 APP 用户关注计数',
  },
  {
    code: 'app:users:rebuild:follow:count:all',
    groupCode: 'app:users',
    name: '全量重建 APP 用户关注计数',
  },
  {
    code: 'app:users:restore',
    groupCode: 'app:users',
    name: '恢复 APP 用户',
  },
  {
    code: 'app:users:update:enabled',
    groupCode: 'app:users',
    name: '更新 APP 用户启用状态',
  },
  {
    code: 'app:users:update:status',
    groupCode: 'app:users',
    name: '更新 APP 用户状态',
  },
  {
    code: 'audit:page',
    groupCode: 'audit',
    name: '获取审计日志列表',
  },
  {
    code: 'check:in:calendar:detail',
    groupCode: 'check:in',
    name: '查询目标周期全局签到日历',
  },
  {
    code: 'check:in:calendar:overview',
    groupCode: 'check:in',
    name: '查询目标周期签到轻量概览',
  },
  {
    code: 'check:in:calendar:signed:user:page',
    groupCode: 'check:in',
    name: '分页查询某日已签用户列表',
  },
  {
    code: 'check:in:calendar:user:detail',
    groupCode: 'check:in',
    name: '查询指定用户目标周期签到日历',
  },
  {
    code: 'check:in:config:detail',
    groupCode: 'check:in',
    name: '查询签到配置详情',
  },
  {
    code: 'check:in:config:update',
    groupCode: 'check:in',
    name: '更新签到配置',
  },
  {
    code: 'check:in:config:update:enabled',
    groupCode: 'check:in',
    name: '更新签到开关',
  },
  {
    code: 'check:in:reconciliation:page',
    groupCode: 'check:in',
    name: '分页查询签到对账结果',
  },
  {
    code: 'check:in:reconciliation:repair',
    groupCode: 'check:in',
    name: '补偿签到奖励',
  },
  {
    code: 'check:in:streak:detail',
    groupCode: 'check:in',
    name: '查询连续签到记录详情',
  },
  {
    code: 'check:in:streak:history:detail',
    groupCode: 'check:in',
    name: '查询连续签到记录历史详情',
  },
  {
    code: 'check:in:streak:history:page',
    groupCode: 'check:in',
    name: '分页查询连续签到记录历史',
  },
  {
    code: 'check:in:streak:page',
    groupCode: 'check:in',
    name: '分页查询连续签到记录',
  },
  {
    code: 'check:in:streak:publish',
    groupCode: 'check:in',
    name: '发布连续签到记录',
  },
  {
    code: 'check:in:streak:repair',
    groupCode: 'check:in',
    name: '重算连续签到进度',
  },
  {
    code: 'check:in:streak:terminate',
    groupCode: 'check:in',
    name: '终止连续签到记录',
  },
  {
    code: 'comment:delete',
    groupCode: 'comment',
    name: '删除评论',
  },
  {
    code: 'comment:detail',
    groupCode: 'comment',
    name: '获取评论详情',
  },
  {
    code: 'comment:page',
    groupCode: 'comment',
    name: '分页查询评论记录',
  },
  {
    code: 'comment:update:audit:status',
    groupCode: 'comment',
    name: '更新评论审核状态',
  },
  {
    code: 'comment:update:hidden',
    groupCode: 'comment',
    name: '更新评论隐藏状态',
  },
  {
    code: 'content:author:create',
    groupCode: 'content:author',
    name: '创建作者',
  },
  {
    code: 'content:author:delete',
    groupCode: 'content:author',
    name: '删除作者',
  },
  {
    code: 'content:author:detail',
    groupCode: 'content:author',
    name: '获取作者详情',
  },
  {
    code: 'content:author:page',
    groupCode: 'content:author',
    name: '分页查询作者列表',
  },
  {
    code: 'content:author:rebuild:follow:count',
    groupCode: 'content:author',
    name: '重建作者关注计数',
  },
  {
    code: 'content:author:rebuild:follow:count:all',
    groupCode: 'content:author',
    name: '全量重建作者关注计数',
  },
  {
    code: 'content:author:rebuild:work:count',
    groupCode: 'content:author',
    name: '重建作者作品计数',
  },
  {
    code: 'content:author:rebuild:work:count:all',
    groupCode: 'content:author',
    name: '全量重建作者作品计数',
  },
  {
    code: 'content:author:update',
    groupCode: 'content:author',
    name: '更新作者信息',
  },
  {
    code: 'content:author:update:recommended',
    groupCode: 'content:author',
    name: '更新作者推荐状态',
  },
  {
    code: 'content:author:update:status',
    groupCode: 'content:author',
    name: '更新作者状态',
  },
  {
    code: 'content:category:create',
    groupCode: 'content:category',
    name: '创建分类',
  },
  {
    code: 'content:category:delete',
    groupCode: 'content:category',
    name: '删除分类',
  },
  {
    code: 'content:category:detail',
    groupCode: 'content:category',
    name: '获取分类详情',
  },
  {
    code: 'content:category:page',
    groupCode: 'content:category',
    name: '分页查询分类列表',
  },
  {
    code: 'content:category:swap:sort:order',
    groupCode: 'content:category',
    name: '分类交换排序',
  },
  {
    code: 'content:category:update',
    groupCode: 'content:category',
    name: '更新分类信息',
  },
  {
    code: 'content:category:update:status',
    groupCode: 'content:category',
    name: '更新分类状态',
  },
  {
    code: 'content:comic:chapter:batch:delete',
    groupCode: 'content:comic:chapter',
    name: '批量删除漫画章节',
  },
  {
    code: 'content:comic:chapter:batch:update:status',
    groupCode: 'content:comic:chapter',
    name: '批量更新漫画章节发布状态',
  },
  {
    code: 'content:comic:chapter:content:archive:confirm',
    groupCode: 'content:comic:chapter:content',
    name: '确认漫画压缩包导入',
  },
  {
    code: 'content:comic:chapter:content:archive:detail',
    groupCode: 'content:comic:chapter:content',
    name: '查询漫画压缩包导入任务详情',
  },
  {
    code: 'content:comic:chapter:content:archive:discard',
    groupCode: 'content:comic:chapter:content',
    name: '丢弃漫画压缩包预解析会话',
  },
  {
    code: 'content:comic:chapter:content:archive:preview',
    groupCode: 'content:comic:chapter:content',
    name: '预解析漫画压缩包',
  },
  {
    code: 'content:comic:chapter:content:archive:session',
    groupCode: 'content:comic:chapter:content',
    name: '创建漫画压缩包预解析会话',
  },
  {
    code: 'content:comic:chapter:content:clear',
    groupCode: 'content:comic:chapter:content',
    name: '清空章节内容',
  },
  {
    code: 'content:comic:chapter:content:delete',
    groupCode: 'content:comic:chapter:content',
    name: '删除章节内容',
  },
  {
    code: 'content:comic:chapter:content:list',
    groupCode: 'content:comic:chapter:content',
    name: '获取章节内容',
  },
  {
    code: 'content:comic:chapter:content:move',
    groupCode: 'content:comic:chapter:content',
    name: '移动章节内容',
  },
  {
    code: 'content:comic:chapter:content:update',
    groupCode: 'content:comic:chapter:content',
    name: '更新章节内容',
  },
  {
    code: 'content:comic:chapter:content:upload',
    groupCode: 'content:comic:chapter:content',
    name: '上传章节内容',
  },
  {
    code: 'content:comic:chapter:create',
    groupCode: 'content:comic:chapter',
    name: '创建漫画章节',
  },
  {
    code: 'content:comic:chapter:delete',
    groupCode: 'content:comic:chapter',
    name: '删除漫画章节',
  },
  {
    code: 'content:comic:chapter:detail',
    groupCode: 'content:comic:chapter',
    name: '获取漫画章节详情',
  },
  {
    code: 'content:comic:chapter:page',
    groupCode: 'content:comic:chapter',
    name: '分页查询漫画章节列表',
  },
  {
    code: 'content:comic:chapter:swap:sort:order',
    groupCode: 'content:comic:chapter',
    name: '交换章节序号',
  },
  {
    code: 'content:comic:chapter:update',
    groupCode: 'content:comic:chapter',
    name: '更新漫画章节',
  },
  {
    code: 'content:comic:create',
    groupCode: 'content:comic',
    name: '创建漫画',
  },
  {
    code: 'content:comic:delete',
    groupCode: 'content:comic',
    name: '软删除漫画',
  },
  {
    code: 'content:comic:detail',
    groupCode: 'content:comic',
    name: '获取漫画详情',
  },
  {
    code: 'content:comic:page',
    groupCode: 'content:comic',
    name: '分页查询漫画列表',
  },
  {
    code: 'content:comic:third:party:chapter:content:detail',
    groupCode: 'content:comic:third:party',
    name: '获取第三方平台漫画章节内容',
  },
  {
    code: 'content:comic:third:party:chapter:list',
    groupCode: 'content:comic:third:party',
    name: '获取第三方平台漫画章节列表',
  },
  {
    code: 'content:comic:third:party:detail',
    groupCode: 'content:comic:third:party',
    name: '获取第三方平台漫画详情',
  },
  {
    code: 'content:comic:third:party:import:confirm',
    groupCode: 'content:comic:third:party',
    name: '确认第三方漫画导入并创建工作流任务',
  },
  {
    code: 'content:comic:third:party:import:item:page',
    groupCode: 'content:comic:third:party',
    name: '分页查询三方解析内容导入条目',
  },
  {
    code: 'content:comic:third:party:import:preview',
    groupCode: 'content:comic:third:party',
    name: '预览第三方漫画导入',
  },
  {
    code: 'content:comic:third:party:platform:list',
    groupCode: 'content:comic:third:party',
    name: '获取第三方漫画平台列表',
  },
  {
    code: 'content:comic:third:party:search:page',
    groupCode: 'content:comic:third:party',
    name: '搜索第三方平台漫画',
  },
  {
    code: 'content:comic:third:party:sync:latest',
    groupCode: 'content:comic:third:party',
    name: '同步第三方漫画最新章节',
  },
  {
    code: 'content:comic:update',
    groupCode: 'content:comic',
    name: '更新漫画信息',
  },
  {
    code: 'content:comic:update:hot',
    groupCode: 'content:comic',
    name: '更新漫画热门状态',
  },
  {
    code: 'content:comic:update:new',
    groupCode: 'content:comic',
    name: '更新漫画新作状态',
  },
  {
    code: 'content:comic:update:recommended',
    groupCode: 'content:comic',
    name: '更新漫画推荐状态',
  },
  {
    code: 'content:comic:update:status',
    groupCode: 'content:comic',
    name: '更新漫画发布状态',
  },
  {
    code: 'content:emoji:asset:create',
    groupCode: 'content:emoji:asset',
    name: '创建表情资源',
  },
  {
    code: 'content:emoji:asset:delete',
    groupCode: 'content:emoji:asset',
    name: '删除表情资源',
  },
  {
    code: 'content:emoji:asset:detail',
    groupCode: 'content:emoji:asset',
    name: '查询表情资源详情',
  },
  {
    code: 'content:emoji:asset:page',
    groupCode: 'content:emoji:asset',
    name: '分页查询表情资源',
  },
  {
    code: 'content:emoji:asset:swap:sort:order',
    groupCode: 'content:emoji:asset',
    name: '交换表情资源排序',
  },
  {
    code: 'content:emoji:asset:update',
    groupCode: 'content:emoji:asset',
    name: '更新表情资源',
  },
  {
    code: 'content:emoji:asset:update:enabled',
    groupCode: 'content:emoji:asset',
    name: '更新表情资源启用状态',
  },
  {
    code: 'content:emoji:pack:create',
    groupCode: 'content:emoji:pack',
    name: '创建表情包',
  },
  {
    code: 'content:emoji:pack:delete',
    groupCode: 'content:emoji:pack',
    name: '删除表情包',
  },
  {
    code: 'content:emoji:pack:detail',
    groupCode: 'content:emoji:pack',
    name: '查询表情包详情',
  },
  {
    code: 'content:emoji:pack:page',
    groupCode: 'content:emoji:pack',
    name: '分页查询表情包',
  },
  {
    code: 'content:emoji:pack:swap:sort:order',
    groupCode: 'content:emoji:pack',
    name: '交换表情包排序',
  },
  {
    code: 'content:emoji:pack:update',
    groupCode: 'content:emoji:pack',
    name: '更新表情包',
  },
  {
    code: 'content:emoji:pack:update:enabled',
    groupCode: 'content:emoji:pack',
    name: '更新表情包启用状态',
  },
  {
    code: 'content:emoji:pack:update:scene:type',
    groupCode: 'content:emoji:pack',
    name: '更新表情包场景类型',
  },
  {
    code: 'content:novel:chapter:batch:delete',
    groupCode: 'content:novel:chapter',
    name: '批量删除小说章节',
  },
  {
    code: 'content:novel:chapter:batch:update:status',
    groupCode: 'content:novel:chapter',
    name: '批量更新小说章节发布状态',
  },
  {
    code: 'content:novel:chapter:content:delete',
    groupCode: 'content:novel:chapter:content',
    name: '删除章节文件',
  },
  {
    code: 'content:novel:chapter:content:detail',
    groupCode: 'content:novel:chapter:content',
    name: '获取章节内容',
  },
  {
    code: 'content:novel:chapter:content:upload',
    groupCode: 'content:novel:chapter:content',
    name: '上传章节文件',
  },
  {
    code: 'content:novel:chapter:create',
    groupCode: 'content:novel:chapter',
    name: '创建小说章节',
  },
  {
    code: 'content:novel:chapter:delete',
    groupCode: 'content:novel:chapter',
    name: '删除小说章节',
  },
  {
    code: 'content:novel:chapter:detail',
    groupCode: 'content:novel:chapter',
    name: '获取小说章节详情',
  },
  {
    code: 'content:novel:chapter:page',
    groupCode: 'content:novel:chapter',
    name: '分页查询小说章节列表',
  },
  {
    code: 'content:novel:chapter:swap:sort:order',
    groupCode: 'content:novel:chapter',
    name: '交换章节序号',
  },
  {
    code: 'content:novel:chapter:update',
    groupCode: 'content:novel:chapter',
    name: '更新小说章节',
  },
  {
    code: 'content:novel:create',
    groupCode: 'content:novel',
    name: '创建小说',
  },
  {
    code: 'content:novel:delete',
    groupCode: 'content:novel',
    name: '软删除小说',
  },
  {
    code: 'content:novel:detail',
    groupCode: 'content:novel',
    name: '获取小说详情',
  },
  {
    code: 'content:novel:page',
    groupCode: 'content:novel',
    name: '分页查询小说列表',
  },
  {
    code: 'content:novel:update',
    groupCode: 'content:novel',
    name: '更新小说信息',
  },
  {
    code: 'content:novel:update:hot',
    groupCode: 'content:novel',
    name: '更新小说热门状态',
  },
  {
    code: 'content:novel:update:new',
    groupCode: 'content:novel',
    name: '更新小说新作状态',
  },
  {
    code: 'content:novel:update:recommended',
    groupCode: 'content:novel',
    name: '更新小说推荐状态',
  },
  {
    code: 'content:novel:update:status',
    groupCode: 'content:novel',
    name: '更新小说发布状态',
  },
  {
    code: 'content:tag:create',
    groupCode: 'content:tag',
    name: '创建标签',
  },
  {
    code: 'content:tag:delete',
    groupCode: 'content:tag',
    name: '删除标签',
  },
  {
    code: 'content:tag:detail',
    groupCode: 'content:tag',
    name: '获取标签详情',
  },
  {
    code: 'content:tag:page',
    groupCode: 'content:tag',
    name: '分页查询标签列表',
  },
  {
    code: 'content:tag:swap:sort:order',
    groupCode: 'content:tag',
    name: '标签交换排序',
  },
  {
    code: 'content:tag:update',
    groupCode: 'content:tag',
    name: '更新标签信息',
  },
  {
    code: 'content:tag:update:status',
    groupCode: 'content:tag',
    name: '更新标签状态',
  },
  {
    code: 'coupon:definition:create',
    groupCode: 'coupon',
    name: '创建券定义',
  },
  {
    code: 'coupon:definition:page',
    groupCode: 'coupon',
    name: '分页查询券定义',
  },
  {
    code: 'coupon:definition:update',
    groupCode: 'coupon',
    name: '更新券定义',
  },
  {
    code: 'coupon:definition:update:status',
    groupCode: 'coupon',
    name: '更新券定义启用状态',
  },
  {
    code: 'coupon:grant:workflow:create',
    groupCode: 'coupon',
    name: '创建批量发券任务',
  },
  {
    code: 'dictionary:create',
    groupCode: 'dictionary',
    name: '创建字典',
  },
  {
    code: 'dictionary:delete',
    groupCode: 'dictionary',
    name: '删除字典',
  },
  {
    code: 'dictionary:detail',
    groupCode: 'dictionary',
    name: '获取字典详情',
  },
  {
    code: 'dictionary:item:create',
    groupCode: 'dictionary',
    name: '创建字典项',
  },
  {
    code: 'dictionary:item:delete',
    groupCode: 'dictionary',
    name: '删除字典项',
  },
  {
    code: 'dictionary:item:list',
    groupCode: 'dictionary',
    name: '获取所有字典项',
  },
  {
    code: 'dictionary:item:page',
    groupCode: 'dictionary',
    name: '分页获取字典项',
  },
  {
    code: 'dictionary:item:swap:sort:order',
    groupCode: 'dictionary',
    name: '字典项交换排序',
  },
  {
    code: 'dictionary:item:update',
    groupCode: 'dictionary',
    name: '更新字典项',
  },
  {
    code: 'dictionary:item:update:status',
    groupCode: 'dictionary',
    name: '启用禁用字典项',
  },
  {
    code: 'dictionary:page',
    groupCode: 'dictionary',
    name: '分页查询字典',
  },
  {
    code: 'dictionary:update',
    groupCode: 'dictionary',
    name: '更新字典',
  },
  {
    code: 'dictionary:update:status',
    groupCode: 'dictionary',
    name: '更新字典状态',
  },
  {
    code: 'forum:hashtags:create',
    groupCode: 'forum:hashtags',
    name: '创建论坛话题',
  },
  {
    code: 'forum:hashtags:detail',
    groupCode: 'forum:hashtags',
    name: '获取论坛话题详情',
  },
  {
    code: 'forum:hashtags:page',
    groupCode: 'forum:hashtags',
    name: '分页查询论坛话题',
  },
  {
    code: 'forum:hashtags:update',
    groupCode: 'forum:hashtags',
    name: '更新论坛话题',
  },
  {
    code: 'forum:hashtags:update:audit:status',
    groupCode: 'forum:hashtags',
    name: '更新论坛话题审核状态',
  },
  {
    code: 'forum:hashtags:update:hidden',
    groupCode: 'forum:hashtags',
    name: '更新论坛话题隐藏状态',
  },
  {
    code: 'forum:moderator:action:log:page',
    groupCode: 'forum:moderator:action:log',
    name: '查看版主操作日志',
  },
  {
    code: 'forum:moderator:application:audit',
    groupCode: 'forum:moderator:application',
    name: '审核版主申请',
  },
  {
    code: 'forum:moderator:application:delete',
    groupCode: 'forum:moderator:application',
    name: '删除版主申请',
  },
  {
    code: 'forum:moderator:application:detail',
    groupCode: 'forum:moderator:application',
    name: '获取版主申请详情',
  },
  {
    code: 'forum:moderator:application:page',
    groupCode: 'forum:moderator:application',
    name: '分页查询版主申请',
  },
  {
    code: 'forum:moderator:lifecycle:log:page',
    groupCode: 'forum:moderator:lifecycle:log',
    name: '分页查询版主生命周期日志',
  },
  {
    code: 'forum:moderators:assign:section',
    groupCode: 'forum:moderators',
    name: '分配版主管理的板块',
  },
  {
    code: 'forum:moderators:create',
    groupCode: 'forum:moderators',
    name: '添加版主',
  },
  {
    code: 'forum:moderators:delete',
    groupCode: 'forum:moderators',
    name: '移除版主',
  },
  {
    code: 'forum:moderators:detail',
    groupCode: 'forum:moderators',
    name: '查看版主详情',
  },
  {
    code: 'forum:moderators:page',
    groupCode: 'forum:moderators',
    name: '查看版主列表',
  },
  {
    code: 'forum:moderators:update',
    groupCode: 'forum:moderators',
    name: '更新版主信息',
  },
  {
    code: 'forum:search:page',
    groupCode: 'forum:search',
    name: '分页搜索论坛主题与回复',
  },
  {
    code: 'forum:section:groups:create',
    groupCode: 'forum:section:groups',
    name: '添加板块组',
  },
  {
    code: 'forum:section:groups:delete',
    groupCode: 'forum:section:groups',
    name: '删除板块组',
  },
  {
    code: 'forum:section:groups:detail',
    groupCode: 'forum:section:groups',
    name: '查看板块组详情',
  },
  {
    code: 'forum:section:groups:page',
    groupCode: 'forum:section:groups',
    name: '查看板块组列表',
  },
  {
    code: 'forum:section:groups:swap:sort:order',
    groupCode: 'forum:section:groups',
    name: '交换板块组排序顺序',
  },
  {
    code: 'forum:section:groups:update',
    groupCode: 'forum:section:groups',
    name: '更新板块组',
  },
  {
    code: 'forum:section:groups:update:enabled',
    groupCode: 'forum:section:groups',
    name: '更新板块组启用状态',
  },
  {
    code: 'forum:sections:create',
    groupCode: 'forum:sections',
    name: '添加板块',
  },
  {
    code: 'forum:sections:delete',
    groupCode: 'forum:sections',
    name: '删除板块',
  },
  {
    code: 'forum:sections:detail',
    groupCode: 'forum:sections',
    name: '查看板块详情',
  },
  {
    code: 'forum:sections:page',
    groupCode: 'forum:sections',
    name: '查看板块分页',
  },
  {
    code: 'forum:sections:rebuild:counts',
    groupCode: 'forum:sections',
    name: '重建板块计数',
  },
  {
    code: 'forum:sections:rebuild:counts:all',
    groupCode: 'forum:sections',
    name: '全量重建板块计数',
  },
  {
    code: 'forum:sections:swap:sort:order',
    groupCode: 'forum:sections',
    name: '交换板块排序顺序',
  },
  {
    code: 'forum:sections:tree',
    groupCode: 'forum:sections',
    name: '查看板块树',
  },
  {
    code: 'forum:sections:update',
    groupCode: 'forum:sections',
    name: '更新板块',
  },
  {
    code: 'forum:sections:update:enabled',
    groupCode: 'forum:sections',
    name: '更新板块启用状态',
  },
  {
    code: 'forum:sensitive:word:count',
    groupCode: 'forum:sensitive:word',
    name: '获取当前加载的敏感词数量',
  },
  {
    code: 'forum:sensitive:word:create',
    groupCode: 'forum:sensitive:word',
    name: '创建敏感词',
  },
  {
    code: 'forum:sensitive:word:delete',
    groupCode: 'forum:sensitive:word',
    name: '删除敏感词',
  },
  {
    code: 'forum:sensitive:word:detect',
    groupCode: 'forum:sensitive:word',
    name: '检测文本中的敏感词',
  },
  {
    code: 'forum:sensitive:word:detect:highest:level',
    groupCode: 'forum:sensitive:word',
    name: '获取文本中敏感词的最高等级',
  },
  {
    code: 'forum:sensitive:word:detect:status',
    groupCode: 'forum:sensitive:word',
    name: '检查敏感词检测器状态',
  },
  {
    code: 'forum:sensitive:word:hit:log:page',
    groupCode: 'forum:sensitive:word',
    name: '获取敏感词命中日志分页列表',
  },
  {
    code: 'forum:sensitive:word:page',
    groupCode: 'forum:sensitive:word',
    name: '获取敏感词分页列表',
  },
  {
    code: 'forum:sensitive:word:replace',
    groupCode: 'forum:sensitive:word',
    name: '替换文本中的敏感词',
  },
  {
    code: 'forum:sensitive:word:stats',
    groupCode: 'forum:sensitive:word',
    name: '获取统计查询结果',
  },
  {
    code: 'forum:sensitive:word:stats:full',
    groupCode: 'forum:sensitive:word',
    name: '获取完整统计数据',
  },
  {
    code: 'forum:sensitive:word:update',
    groupCode: 'forum:sensitive:word',
    name: '更新敏感词',
  },
  {
    code: 'forum:sensitive:word:update:status',
    groupCode: 'forum:sensitive:word',
    name: '更新敏感词状态',
  },
  {
    code: 'forum:topic:create',
    groupCode: 'forum:topic',
    name: '创建论坛主题',
  },
  {
    code: 'forum:topic:delete',
    groupCode: 'forum:topic',
    name: '删除论坛主题',
  },
  {
    code: 'forum:topic:detail',
    groupCode: 'forum:topic',
    name: '获取论坛主题详情',
  },
  {
    code: 'forum:topic:move',
    groupCode: 'forum:topic',
    name: '移动论坛主题板块',
  },
  {
    code: 'forum:topic:page',
    groupCode: 'forum:topic',
    name: '分页查询论坛主题列表',
  },
  {
    code: 'forum:topic:restore',
    groupCode: 'forum:topic',
    name: '恢复已删除论坛主题',
  },
  {
    code: 'forum:topic:update',
    groupCode: 'forum:topic',
    name: '更新论坛主题',
  },
  {
    code: 'forum:topic:update:audit:status',
    groupCode: 'forum:topic',
    name: '更新主题审核状态',
  },
  {
    code: 'forum:topic:update:featured',
    groupCode: 'forum:topic',
    name: '更新主题精华状态',
  },
  {
    code: 'forum:topic:update:hidden',
    groupCode: 'forum:topic',
    name: '更新主题隐藏状态',
  },
  {
    code: 'forum:topic:update:locked',
    groupCode: 'forum:topic',
    name: '更新主题锁定状态',
  },
  {
    code: 'forum:topic:update:pinned',
    groupCode: 'forum:topic',
    name: '更新主题置顶状态',
  },
  {
    code: 'growth:badges:assign',
    groupCode: 'growth:badges',
    name: '为用户分配用户徽章',
  },
  {
    code: 'growth:badges:create',
    groupCode: 'growth:badges',
    name: '创建用户徽章',
  },
  {
    code: 'growth:badges:delete',
    groupCode: 'growth:badges',
    name: '删除用户徽章',
  },
  {
    code: 'growth:badges:detail',
    groupCode: 'growth:badges',
    name: '获取用户徽章详情',
  },
  {
    code: 'growth:badges:page',
    groupCode: 'growth:badges',
    name: '获取用户徽章分页',
  },
  {
    code: 'growth:badges:revoke',
    groupCode: 'growth:badges',
    name: '撤销用户徽章',
  },
  {
    code: 'growth:badges:stats',
    groupCode: 'growth:badges',
    name: '获取用户徽章统计信息',
  },
  {
    code: 'growth:badges:update',
    groupCode: 'growth:badges',
    name: '更新用户徽章',
  },
  {
    code: 'growth:badges:update:status',
    groupCode: 'growth:badges',
    name: '更新用户徽章状态',
  },
  {
    code: 'growth:badges:user:page',
    groupCode: 'growth:badges',
    name: '获取拥有某个用户徽章的用户列表',
  },
  {
    code: 'growth:experience:record:detail',
    groupCode: 'growth:experience',
    name: '获取用户经验记录详情',
  },
  {
    code: 'growth:experience:record:page',
    groupCode: 'growth:experience',
    name: '获取用户经验记录分页',
  },
  {
    code: 'growth:experience:stats',
    groupCode: 'growth:experience',
    name: '获取用户经验统计信息',
  },
  {
    code: 'growth:level:rules:create',
    groupCode: 'growth:level:rules',
    name: '创建用户等级规则',
  },
  {
    code: 'growth:level:rules:delete',
    groupCode: 'growth:level:rules',
    name: '删除用户等级规则',
  },
  {
    code: 'growth:level:rules:detail',
    groupCode: 'growth:level:rules',
    name: '获取用户等级规则详情',
  },
  {
    code: 'growth:level:rules:page',
    groupCode: 'growth:level:rules',
    name: '获取用户等级规则分页',
  },
  {
    code: 'growth:level:rules:permission:check',
    groupCode: 'growth:level:rules',
    name: '检查用户等级权限配置',
  },
  {
    code: 'growth:level:rules:stats',
    groupCode: 'growth:level:rules',
    name: '获取用户等级统计信息',
  },
  {
    code: 'growth:level:rules:update',
    groupCode: 'growth:level:rules',
    name: '更新用户等级规则',
  },
  {
    code: 'growth:level:rules:user:detail',
    groupCode: 'growth:level:rules',
    name: '获取用户等级信息详情',
  },
  {
    code: 'growth:reward:event:option:list',
    groupCode: 'growth',
    name: '查询允许配置基础奖励规则的成长事件选项',
  },
  {
    code: 'growth:reward:rules:archive',
    groupCode: 'growth:reward:rules',
    name: '归档成长奖励规则',
  },
  {
    code: 'growth:reward:rules:create',
    groupCode: 'growth:reward:rules',
    name: '创建成长奖励规则',
  },
  {
    code: 'growth:reward:rules:detail',
    groupCode: 'growth:reward:rules',
    name: '查询成长奖励规则详情',
  },
  {
    code: 'growth:reward:rules:page',
    groupCode: 'growth:reward:rules',
    name: '分页查询成长奖励规则',
  },
  {
    code: 'growth:reward:rules:update',
    groupCode: 'growth:reward:rules',
    name: '更新成长奖励规则',
  },
  {
    code: 'growth:reward:settlement:page',
    groupCode: 'growth',
    name: '分页查询通用成长奖励补偿记录',
  },
  {
    code: 'growth:reward:settlement:retry',
    groupCode: 'growth',
    name: '重试单条通用成长奖励补偿',
  },
  {
    code: 'growth:reward:settlement:retry:pending:batch',
    groupCode: 'growth',
    name: '批量重试待补偿的通用成长奖励记录',
  },
  {
    code: 'growth:rule:events:page',
    groupCode: 'growth',
    name: '按事件聚合查看积分规则、经验规则与任务 bonus 关联关系',
  },
  {
    code: 'membership:benefit:create',
    groupCode: 'membership',
    name: '创建会员权益定义',
  },
  {
    code: 'membership:benefit:page',
    groupCode: 'membership',
    name: '分页查询会员权益定义',
  },
  {
    code: 'membership:benefit:update',
    groupCode: 'membership',
    name: '更新会员权益定义',
  },
  {
    code: 'membership:benefit:update:status',
    groupCode: 'membership',
    name: '更新会员权益启用状态',
  },
  {
    code: 'membership:page:config:create',
    groupCode: 'membership',
    name: '创建会员订阅页配置',
  },
  {
    code: 'membership:page:config:page',
    groupCode: 'membership',
    name: '分页查询会员订阅页配置',
  },
  {
    code: 'membership:page:config:update',
    groupCode: 'membership',
    name: '更新会员订阅页配置',
  },
  {
    code: 'membership:page:config:update:status',
    groupCode: 'membership',
    name: '更新会员订阅页配置启用状态',
  },
  {
    code: 'membership:plan:create',
    groupCode: 'membership',
    name: '创建 VIP 套餐',
  },
  {
    code: 'membership:plan:page',
    groupCode: 'membership',
    name: '分页查询 VIP 套餐',
  },
  {
    code: 'membership:plan:update',
    groupCode: 'membership',
    name: '更新 VIP 套餐',
  },
  {
    code: 'membership:plan:update:status',
    groupCode: 'membership',
    name: '更新 VIP 套餐启用状态',
  },
  {
    code: 'message:chat:conversation:page',
    groupCode: 'message',
    name: '分页查询聊天会话排查列表',
  },
  {
    code: 'message:chat:message:page',
    groupCode: 'message',
    name: '分页查询聊天消息排查列表',
  },
  {
    code: 'message:monitor:delivery:page',
    groupCode: 'message',
    name: '分页查询通知投递结果',
  },
  {
    code: 'message:monitor:delivery:retry',
    groupCode: 'message',
    name: '按投递记录重试失败的通知投递',
  },
  {
    code: 'message:monitor:dispatch:page',
    groupCode: 'message',
    name: '分页查询通知 dispatch 调度结果',
  },
  {
    code: 'message:monitor:summary',
    groupCode: 'message',
    name: '获取消息运行摘要',
  },
  {
    code: 'message:monitor:ws:summary',
    groupCode: 'message',
    name: '获取消息 WS 监控摘要',
  },
  {
    code: 'message:notification:templates:create',
    groupCode: 'message:notification:templates',
    name: '创建通知模板',
  },
  {
    code: 'message:notification:templates:detail',
    groupCode: 'message:notification:templates',
    name: '获取通知模板详情',
  },
  {
    code: 'message:notification:templates:page',
    groupCode: 'message:notification:templates',
    name: '分页查询通知模板',
  },
  {
    code: 'message:notification:templates:preview',
    groupCode: 'message:notification:templates',
    name: '预览通知模板渲染结果',
  },
  {
    code: 'message:notification:templates:update',
    groupCode: 'message:notification:templates',
    name: '更新通知模板',
  },
  {
    code: 'message:notification:templates:update:enabled',
    groupCode: 'message:notification:templates',
    name: '更新通知模板启用状态',
  },
  {
    code: 'payment:certificate:option:list',
    groupCode: 'payment',
    name: '查询支付证书选项',
  },
  {
    code: 'payment:credential:option:list',
    groupCode: 'payment',
    name: '查询支付凭据选项',
  },
  {
    code: 'payment:order:page',
    groupCode: 'payment',
    name: '分页查询支付订单',
  },
  {
    code: 'payment:order:repair:paid',
    groupCode: 'payment',
    name: '异常修复支付订单为已支付',
  },
  {
    code: 'payment:provider:account:option:list',
    groupCode: 'payment',
    name: '查询支付 provider 账号选项',
  },
  {
    code: 'payment:provider:create',
    groupCode: 'payment',
    name: '创建支付 provider 配置',
  },
  {
    code: 'payment:provider:page',
    groupCode: 'payment',
    name: '分页查询支付 provider 配置',
  },
  {
    code: 'payment:provider:update',
    groupCode: 'payment',
    name: '更新支付 provider 配置',
  },
  {
    code: 'payment:provider:update:status',
    groupCode: 'payment',
    name: '更新支付 provider 启用状态',
  },
  {
    code: 'payment:reconcile:page',
    groupCode: 'payment',
    name: '分页查询支付对账记录',
  },
  {
    code: 'report:detail',
    groupCode: 'report',
    name: '获取举报详情',
  },
  {
    code: 'report:handle',
    groupCode: 'report',
    name: '处理举报',
  },
  {
    code: 'report:page',
    groupCode: 'report',
    name: '分页查询举报记录',
  },
  {
    code: 'system:config',
    groupCode: 'system',
    name: '获取系统配置',
  },
  {
    code: 'system:ip2region:status',
    groupCode: 'system:ip2region',
    name: '获取当前 IP 属地库状态',
  },
  {
    code: 'system:ip2region:upload',
    groupCode: 'system:ip2region',
    name: '上传 ip2region xdb 并热切换当前进程',
  },
  {
    code: 'system:menu:create',
    groupCode: 'system:menu',
    name: '创建菜单',
  },
  {
    code: 'system:menu:current',
    groupCode: 'system:menu',
    name: '获取当前菜单权限',
  },
  {
    code: 'system:menu:delete',
    groupCode: 'system:menu',
    name: '删除菜单',
  },
  {
    code: 'system:menu:drag-reorder',
    groupCode: 'system:menu',
    name: '拖拽调整菜单',
  },
  {
    code: 'system:menu:tree',
    groupCode: 'system:menu',
    name: '查询菜单树',
  },
  {
    code: 'system:menu:update',
    groupCode: 'system:menu',
    name: '更新菜单',
  },
  {
    code: 'system:menu:update-status',
    groupCode: 'system:menu',
    name: '更新菜单状态',
  },
  {
    code: 'system:permission:list',
    groupCode: 'system:permission',
    name: '查询权限清单',
  },
  {
    code: 'system:role:bind-menus',
    groupCode: 'system:role',
    name: '绑定角色菜单',
  },
  {
    code: 'system:role:bind-permissions',
    groupCode: 'system:role',
    name: '绑定角色权限',
  },
  {
    code: 'system:role:create',
    groupCode: 'system:role',
    name: '创建角色',
  },
  {
    code: 'system:role:delete',
    groupCode: 'system:role',
    name: '删除角色',
  },
  {
    code: 'system:role:detail',
    groupCode: 'system:role',
    name: '查询角色详情',
  },
  {
    code: 'system:role:list',
    groupCode: 'system:role',
    name: '查询角色列表',
  },
  {
    code: 'system:role:page',
    groupCode: 'system:role',
    name: '分页查询角色',
  },
  {
    code: 'system:role:update',
    groupCode: 'system:role',
    name: '更新角色',
  },
  {
    code: 'system:role:update-status',
    groupCode: 'system:role',
    name: '更新角色状态',
  },
  {
    code: 'system:update',
    groupCode: 'system',
    name: '更新系统配置',
  },
  {
    code: 'system:user:create',
    groupCode: 'system:user',
    name: '用户注册',
  },
  {
    code: 'system:user:detail',
    groupCode: 'system:user',
    name: '根据ID获取用户信息',
  },
  {
    code: 'system:user:page',
    groupCode: 'system:user',
    name: '获取管理端用户分页列表',
  },
  {
    code: 'system:user:password:change',
    groupCode: 'system:user',
    name: '修改密码',
  },
  {
    code: 'system:user:password:reset',
    groupCode: 'system:user',
    name: '重置用户密码',
  },
  {
    code: 'system:user:profile',
    groupCode: 'system:user',
    name: '获取当前用户信息',
  },
  {
    code: 'system:user:profile:update',
    groupCode: 'system:user',
    name: '更新当前用户资料',
  },
  {
    code: 'system:user:unlock',
    groupCode: 'system:user',
    name: '解锁指定用户的锁定状态',
  },
  {
    code: 'system:user:update',
    groupCode: 'system:user',
    name: '更新管理员账号',
  },
  {
    code: 'task:create',
    groupCode: 'task',
    name: '创建任务',
  },
  {
    code: 'task:delete',
    groupCode: 'task',
    name: '删除任务',
  },
  {
    code: 'task:detail',
    groupCode: 'task',
    name: '查询任务详情',
  },
  {
    code: 'task:event:failure:page',
    groupCode: 'task',
    name: '分页查询任务事件消费失败事实',
  },
  {
    code: 'task:event:failure:retry',
    groupCode: 'task',
    name: '重试单条任务事件消费失败事实',
  },
  {
    code: 'task:event:failure:retry:pending:batch',
    groupCode: 'task',
    name: '批量重试待处理的任务事件消费失败事实',
  },
  {
    code: 'task:instance:page',
    groupCode: 'task',
    name: '分页查询任务实例记录',
  },
  {
    code: 'task:instance:reconciliation:page',
    groupCode: 'task',
    name: '分页查询任务奖励与通知对账视图',
  },
  {
    code: 'task:instance:reward:retry',
    groupCode: 'task',
    name: '重试单条任务实例奖励补偿',
  },
  {
    code: 'task:instance:reward:retry:pending:batch',
    groupCode: 'task',
    name: '批量重试待补偿的任务实例奖励',
  },
  {
    code: 'task:page',
    groupCode: 'task',
    name: '分页查询任务',
  },
  {
    code: 'task:template:options',
    groupCode: 'task',
    name: '查询 task 可消费事件模板选项',
  },
  {
    code: 'task:update',
    groupCode: 'task',
    name: '更新任务',
  },
  {
    code: 'task:update:status',
    groupCode: 'task',
    name: '更新任务状态',
  },
  {
    code: 'upload:file:upload',
    groupCode: 'upload',
    name: '上传文件',
  },
  {
    code: 'wallet:currency:package:create',
    groupCode: 'wallet',
    name: '创建虚拟币充值包',
  },
  {
    code: 'wallet:currency:package:page',
    groupCode: 'wallet',
    name: '分页查询虚拟币充值包',
  },
  {
    code: 'wallet:currency:package:update',
    groupCode: 'wallet',
    name: '更新虚拟币充值包',
  },
  {
    code: 'wallet:currency:package:update:status',
    groupCode: 'wallet',
    name: '更新虚拟币充值包启用状态',
  },
  {
    code: 'wallet:ledger:page',
    groupCode: 'wallet',
    name: '分页查询虚拟币流水',
  },
  {
    code: 'workflow:archive',
    groupCode: 'workflow',
    name: '归档工作流任务',
  },
  {
    code: 'workflow:cancel',
    groupCode: 'workflow',
    name: '取消工作流任务',
  },
  {
    code: 'workflow:detail',
    groupCode: 'workflow',
    name: '查询工作流任务详情',
  },
  {
    code: 'workflow:expire',
    groupCode: 'workflow',
    name: '过期清理工作流 retained resource',
  },
  {
    code: 'workflow:item:page',
    groupCode: 'workflow',
    name: '分页查询工作流条目',
  },
  {
    code: 'workflow:notification:list',
    groupCode: 'workflow',
    name: '查询工作流通知列表',
  },
  {
    code: 'workflow:page',
    groupCode: 'workflow',
    name: '分页查询工作流任务',
  },
  {
    code: 'workflow:record:page',
    groupCode: 'workflow',
    name: '分页查询工作流处理记录',
  },
  {
    code: 'workflow:retry:items',
    groupCode: 'workflow',
    name: '重试工作流失败条目',
  },
  {
    code: 'workflow:type:options',
    groupCode: 'workflow',
    name: '查询工作流类型选项',
  },
] as const satisfies readonly AdminReferencePermission[]

export const ADMIN_REFERENCE_PERMISSION_MANIFEST_DIGEST =
  'c4dd714561a29f09b674d966316f25cb3611989ce4661b57c82868e0e50a4d9c'
