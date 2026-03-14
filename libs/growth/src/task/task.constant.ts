/**
 * 娴犺濮熺化鑽ょ埠鐢悂鍣虹€规矮绠?
 */
export enum TaskTypeEnum {
  /** 閺傜増澧滄禒璇插 */
  NEWBIE = 1,
  /** 閺冦儱鐖舵禒璇插 */
  DAILY = 2,
  /** 閸欘垶鍣告径宥勬崲閸? */
  REPEAT = 3,
  /** 濞茶濮╂禒璇插 */
  ACTIVITY = 4,
  /** 鏉╂劘鎯€娴犺濮? */
  OPERATION = 5,
}

/**
 * 娴犺濮熼悩鑸碘偓浣圭亣娑?
 */
export enum TaskStatusEnum {
  /** 閼藉顭? */
  DRAFT = 0,
  /** 瀹告彃褰傜敮? */
  PUBLISHED = 1,
  /** 瀹歌弓绗呯痪? */
  OFFLINE = 2,
}

/**
 * 娴犺濮熸０鍡楀絿濡€崇础閺嬫矮濡?
 */
export enum TaskClaimModeEnum {
  /** 閼奉亜濮╂０鍡楀絿 */
  AUTO = 1,
  /** 閹靛濮╂０鍡楀絿 */
  MANUAL = 2,
}

/**
 * 娴犺濮熺€瑰本鍨氬Ο鈥崇础閺嬫矮濡?
 */
export enum TaskCompleteModeEnum {
  /** 閼奉亜濮╃€瑰本鍨? */
  AUTO = 1,
  /** 閹靛濮╃€瑰本鍨? */
  MANUAL = 2,
}

/**
 * 娴犺濮熼幐鍥ㄦ烦閻樿埖鈧焦鐏囨稉?
 */
export enum TaskAssignmentStatusEnum {
  /** 瀵板懎绱戞慨? */
  PENDING = 0,
  /** 鏉╂稖顢戞稉? */
  IN_PROGRESS = 1,
  /** 瀹告彃鐣幋? */
  COMPLETED = 2,
  /** 瀹歌尪绻冮張? */
  EXPIRED = 3,
}

/**
 * 娴犺濮熸潻娑樺閸斻劋缍旈弸姘
 */
export enum TaskProgressActionTypeEnum {
  /** 妫板棗褰? */
  CLAIM = 1,
  /** 鏉╂稑瀹抽弴瀛樻煀 */
  PROGRESS = 2,
  /** 鐎瑰本鍨? */
  COMPLETE = 3,
  /** 鏉╁洦婀? */
  EXPIRE = 4,
}

/**
 * 娴犺濮熼柌宥咁槻閸涖劍婀￠弸姘
 */
export enum TaskRepeatTypeEnum {
  /** 娑撯偓濞嗏剝鈧? */
  ONCE = 'once',
  /** 濮ｅ繑妫? */
  DAILY = 'daily',
  /** 濮ｅ繐鎳? */
  WEEKLY = 'weekly',
  /** 濮ｅ繑婀€ */
  MONTHLY = 'monthly',
}
