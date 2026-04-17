export const GROWTH_RULE_TYPE_VALUE_DESCRIPTION =
  '成长规则类型（1=发表主题；2=发表回复；3=主题被点赞；4=回复被点赞；5=主题被收藏；6=每日签到；7=管理员操作；8=主题被浏览；9=主题举报；10=发表评论；11=评论被点赞；12=评论举报；16=帖子被评论；100=漫画作品浏览；101=漫画作品点赞；102=漫画作品收藏；103=漫画作品举报；104=漫画作品评论；200=小说作品浏览；201=小说作品点赞；202=小说作品收藏；203=小说作品举报；204=小说作品评论；300=漫画章节阅读；301=漫画章节点赞；302=漫画章节购买；303=漫画章节下载；304=漫画章节兑换；305=漫画章节举报；306=漫画章节评论；400=小说章节阅读；401=小说章节点赞；402=小说章节购买；403=小说章节下载；404=小说章节兑换；405=小说章节举报；406=小说章节评论；600=获得徽章；601=资料完善；602=头像上传；700=关注用户；701=被关注；702=分享内容；703=邀请用户；800=举报有效；801=举报无效）'

const EVENT_DEFINITION_FACT_SOURCE_SUFFIX =
  ' 完整编码、语义、治理态与实现状态以 EventDefinitionMap / EventDefinitionService 为唯一事实源。'

export const GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION = `${GROWTH_RULE_TYPE_VALUE_DESCRIPTION}${EVENT_DEFINITION_FACT_SOURCE_SUFFIX} 新增或调整规则配置时，建议优先使用 isRuleConfigurable=true 的事件编码。`

export const GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION = `${GROWTH_RULE_TYPE_VALUE_DESCRIPTION}${EVENT_DEFINITION_FACT_SOURCE_SUFFIX} 账本与历史记录展示可能包含 implemented / declared / legacy_compat 三类事件编码。`

export const GROWTH_RULE_TYPE_ADMIN_ACTION_DTO_DESCRIPTION = `${GROWTH_RULE_TYPE_VALUE_DESCRIPTION}${EVENT_DEFINITION_FACT_SOURCE_SUFFIX} 管理端人工补发通常建议使用 ADMIN；若补录治理结果，请使用当前正式事件编码，而不要继续使用历史兼容 *_REPORT。`

export const GROWTH_RULE_EVENT_CODE_DTO_DESCRIPTION = `${GROWTH_RULE_TYPE_VALUE_DESCRIPTION} 仅“事件累计次数驱动”任务需要填写。`
