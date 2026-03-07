# 绉垎宸ュ叿绫绘柟妗堣璁?

## 涓€銆佽儗鏅笌闂

### 褰撳墠鏋舵瀯闂

1. **閲嶅鏌ヨ**锛氱Н鍒嗘湇鍔″唴閮ㄤ細鏌ヨ鐢ㄦ埛锛屼笟鍔″眰宸叉煡璇㈣繃鐨勬暟鎹閲嶅鏌ヨ
2. **浜嬪姟鍒嗙**锛氱Н鍒嗘搷浣滀笌涓氬姟鎿嶄綔涓嶅湪鍚屼竴浜嬪姟锛屽彲鑳藉鑷存暟鎹笉涓€鑷?
3. **鏈嶅姟鑰﹀悎**锛氫笟鍔℃湇鍔￠渶瑕佹敞鍏ョН鍒嗘湇鍔★紝澧炲姞妯″潡闂翠緷璧?

### 鐩爣

- 娑堥櫎鍐椾綑鏁版嵁搴撴煡璇?
- 淇濊瘉浜嬪姟涓€鑷存€?
- 闄嶄綆妯″潡鑰﹀悎搴?
- 鎻愪緵绠€娲佺殑璋冪敤鎺ュ彛

---

## 浜屻€佹柟妗堣璁?

### 2.1 鏍稿績鐞嗗康

灏嗙Н鍒嗛€昏緫浠?鏈嶅姟"闄嶇骇涓?宸ュ叿绫?锛?

- **鏈嶅姟锛圫ervice锛?*锛氭湁鐘舵€併€佸彲娉ㄥ叆銆佽礋璐ｄ笟鍔＄紪鎺?
- **宸ュ叿绫伙紙Helper/Util锛?*锛氭棤鐘舵€併€侀潤鎬佹柟娉曘€佺函鍑芥暟寮?

绉垎鎿嶄綔鏈川鏄細**鍦ㄧ粰瀹氫簨鍔″唴锛屾牴鎹鍒欏啓鍏ヨ褰曞苟鏇存柊鐢ㄦ埛绉垎**锛屼笉闇€瑕佺嫭绔嬬殑鏈嶅姟鐢熷懡鍛ㄦ湡銆?

### 2.2 鐩綍缁撴瀯

```
libs/user/src/
鈹溾攢鈹€ point/
鈹?  鈹溾攢鈹€ dto/
鈹?  鈹?  鈹斺攢鈹€ point-record.dto.ts
鈹?  鈹溾攢鈹€ point.constant.ts
鈹?  鈹溾攢鈹€ point.helper.ts          # 鏂板锛氱Н鍒嗗伐鍏风被
鈹?  鈹溾攢鈹€ point-rule.service.ts    # 淇濈暀锛氳鍒欑鐞嗘湇鍔★紙鍚庡彴閰嶇疆鐢級
鈹?  鈹溾攢鈹€ point.service.ts         # 淇濈暀锛氱嫭绔嬫煡璇㈡湇鍔★紙璁板綍鏌ヨ銆佺粺璁★級
鈹?  鈹斺攢鈹€ point.module.ts
鈹溾攢鈹€ experience/
鈹?  鈹溾攢鈹€ experience.helper.ts     # 鏂板锛氱粡楠屽伐鍏风被锛堝彲閫夛紝绫讳技绉垎锛?
鈹?  鈹斺攢鈹€ ...
鈹溾攢鈹€ growth-rule.constant.ts      # 鎵╁睍锛氭柊澧炶瘎璁虹浉鍏宠鍒欑被鍨?
鈹斺攢鈹€ index.ts
```

### 2.3 绫昏璁?

#### 2.3.1 绉垎宸ュ叿绫?(PointHelper)

```typescript
// libs/user/src/point/point.helper.ts

import type { PrismaTransaction } from '@libs/base/database'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'

/**
 * 绉垎搴旂敤缁撴灉
 */
export interface PointApplyResult {
  /** 鏄惁鎴愬姛搴旂敤 */
  applied: boolean
  /** 鏈簲鐢ㄥ師鍥狅紙褰?applied 涓?false 鏃讹級 */
  reason?: 'rule_not_found' | 'rule_disabled' | 'rule_zero' | 'daily_limit' | 'total_limit' | 'cooldown'
  /** 搴旂敤鐨勭Н鍒嗘暟閲?*/
  points?: number
  /** 搴旂敤鍚庣殑绉垎浣欓 */
  afterPoints?: number
  /** 瑙勫垯ID */
  ruleId?: number
}

/**
 * 绉垎娑堣垂缁撴灉
 */
export interface PointConsumeResult {
  /** 鏄惁鎴愬姛娑堣垂 */
  success: boolean
  /** 澶辫触鍘熷洜 */
  reason?: 'insufficient_balance'
  /** 娑堣垂鐨勭Н鍒嗘暟閲?*/
  points?: number
  /** 娑堣垂鍚庣殑绉垎浣欓 */
  afterPoints?: number
}

/**
 * 绉垎宸ュ叿绫?
 *
 * 璁捐鍘熷垯锛?
 * 1. 鎵€鏈夋柟娉曢兘鏄潤鎬佹柟娉曪紝鏃犵姸鎬?
 * 2. 蹇呴』鍦ㄤ簨鍔″唴璋冪敤锛岀敱璋冪敤鏂圭鐞嗕簨鍔?
 * 3. 涓嶆煡璇㈢敤鎴凤紝鐢辫皟鐢ㄦ柟浼犲叆蹇呰鏁版嵁
 * 4. 杩斿洖璇︾粏缁撴灉锛岀敱璋冪敤鏂瑰喅瀹氬浣曞鐞?
 */
export class PointHelper {
  /**
   * 搴旂敤绉垎瑙勫垯锛堝鍔犵Н鍒嗭級
   *
   * @param tx - Prisma 浜嬪姟瀵硅薄
   * @param params - 鍙傛暟
   * @returns 搴旂敤缁撴灉
   *
   * @example
   * ```ts
   * await this.prisma.$transaction(async (tx) => {
   *   // 涓氬姟閫昏緫...
   *   const comment = await tx.userComment.create({...})
   *
   *   // 搴旂敤绉垎
   *   const result = await PointHelper.applyRule(tx, {
   *     userId,
   *     currentPoints: user.points,
   *     ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
   *     remark: '鍙戣〃璇勮',
   *   })
   *
   *   // 鍙€夛細澶勭悊缁撴灉
   *   if (result.applied) {
   *     console.log(`鑾峰緱绉垎: ${result.points}`)
   *   }
   * })
   * ```
   */
  static async applyRule(
    tx: PrismaTransaction,
    params: {
      /** 鐢ㄦ埛ID */
      userId: number
      /** 鐢ㄦ埛褰撳墠绉垎锛堢敱璋冪敤鏂逛紶鍏ワ紝閬垮厤閲嶅鏌ヨ锛?*/
      currentPoints: number
      /** 绉垎瑙勫垯绫诲瀷 */
      ruleType: GrowthRuleTypeEnum
      /** 澶囨敞 */
      remark?: string
      /** 鐩爣绫诲瀷锛堝彲閫夛紝鐢ㄤ簬鍏宠仈锛?*/
      targetType?: number
      /** 鐩爣ID锛堝彲閫夛紝鐢ㄤ簬鍏宠仈锛?*/
      targetId?: number
    },
  ): Promise<PointApplyResult> {
    const { userId, currentPoints, ruleType, remark, targetType, targetId } = params

    // 1. 鏌ヨ瑙勫垯
    const rule = await tx.userPointRule.findUnique({
      where: { type: ruleType },
      select: {
        id: true,
        points: true,
        dailyLimit: true,
        totalLimit: true,
        cooldownSeconds: true,
        isEnabled: true,
      },
    })

    // 2. 瑙勫垯涓嶅瓨鍦?
    if (!rule) {
      return { applied: false, reason: 'rule_not_found' }
    }

    // 3. 瑙勫垯鏈惎鐢?
    if (!rule.isEnabled) {
      return { applied: false, reason: 'rule_disabled' }
    }

    // 4. 瑙勫垯绉垎涓?0
    if (rule.points === 0) {
      return { applied: false, reason: 'rule_zero' }
    }

    // 5. 姣忔棩涓婇檺妫€鏌?
    if (rule.dailyLimit > 0) {
      const today = getStartOfDay()
      const todayCount = await tx.userPointRecord.count({
        where: {
          userId,
          ruleId: rule.id,
          createdAt: { gte: today },
        },
      })
      if (todayCount >= rule.dailyLimit) {
        return { applied: false, reason: 'daily_limit' }
      }
    }

    // 6. 鎬讳笂闄愭鏌?
    if (rule.totalLimit > 0) {
      const totalCount = await tx.userPointRecord.count({
        where: { userId, ruleId: rule.id },
      })
      if (totalCount >= rule.totalLimit) {
        return { applied: false, reason: 'total_limit' }
      }
    }

    // 7. 鍐峰嵈鏃堕棿妫€鏌?
    if (rule.cooldownSeconds > 0) {
      const lastRecord = await tx.userPointRecord.findFirst({
        where: { userId, ruleId: rule.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      if (lastRecord) {
        const elapsed = Date.now() - lastRecord.createdAt.getTime()
        if (elapsed < rule.cooldownSeconds * 1000) {
          return { applied: false, reason: 'cooldown' }
        }
      }
    }

    // 8. 璁＄畻鏂扮Н鍒?
    const afterPoints = currentPoints + rule.points

    // 9. 鍐欏叆璁板綍 + 鏇存柊鐢ㄦ埛锛堝苟琛屾墽琛岋級
    await Promise.all([
      tx.userPointRecord.create({
        data: {
          userId,
          ruleId: rule.id,
          points: rule.points,
          beforePoints: currentPoints,
          afterPoints,
          remark,
          targetType,
          targetId,
        },
      }),
      tx.appUser.update({
        where: { id: userId },
        data: { points: afterPoints },
      }),
    ])

    return {
      applied: true,
      points: rule.points,
      afterPoints,
      ruleId: rule.id,
    }
  }

  /**
   * 娑堣垂绉垎
   *
   * @param tx - Prisma 浜嬪姟瀵硅薄
   * @param params - 鍙傛暟
   * @returns 娑堣垂缁撴灉
   *
   * @example
   * ```ts
   * const result = await PointHelper.consume(tx, {
   *   userId,
   *   currentPoints: user.points,
   *   points: 100,
   *   remark: '璐拱绔犺妭',
   *   targetType: InteractionTargetTypeEnum.COMIC_CHAPTER,
   *   targetId: chapterId,
   * })
   *
   * if (!result.success) {
   *   throw new BadRequestException('绉垎涓嶈冻')
   * }
   * ```
   */
  static async consume(
    tx: PrismaTransaction,
    params: {
      /** 鐢ㄦ埛ID */
      userId: number
      /** 鐢ㄦ埛褰撳墠绉垎 */
      currentPoints: number
      /** 娑堣垂绉垎鏁伴噺 */
      points: number
      /** 澶囨敞 */
      remark?: string
      /** 鐩爣绫诲瀷 */
      targetType?: number
      /** 鐩爣ID */
      targetId?: number
      /** 鍏戞崲ID */
      exchangeId?: number
    },
  ): Promise<PointConsumeResult> {
    const { userId, currentPoints, points, remark, targetType, targetId, exchangeId } = params

    // 1. 浣欓妫€鏌?
    if (currentPoints < points) {
      return { success: false, reason: 'insufficient_balance' }
    }

    // 2. 璁＄畻鏂扮Н鍒?
    const afterPoints = currentPoints - points

    // 3. 鍐欏叆璁板綍 + 鏇存柊鐢ㄦ埛
    await Promise.all([
      tx.userPointRecord.create({
        data: {
          userId,
          points: -points,
          beforePoints: currentPoints,
          afterPoints,
          remark,
          targetType,
          targetId,
          exchangeId,
        },
      }),
      tx.appUser.update({
        where: { id: userId },
        data: { points: afterPoints },
      }),
    ])

    return {
      success: true,
      points,
      afterPoints,
    }
  }

  /**
   * 鎵归噺搴旂敤绉垎瑙勫垯锛堝悓涓€鐢ㄦ埛澶氫釜瑙勫垯锛?
   *
   * @example
   * ```ts
   * // 鍙戣〃璇勮鍚屾椂鑾峰緱绉垎鍜岀粡楠?
   * const results = await PointHelper.applyRules(tx, {
   *   userId,
   *   currentPoints: user.points,
   *   rules: [
   *     { ruleType: GrowthRuleTypeEnum.CREATE_COMMENT, remark: '鍙戣〃璇勮' },
   *     { ruleType: GrowthRuleTypeEnum.FIRST_COMMENT_OF_DAY, remark: '姣忔棩棣栬瘎' },
   *   ],
   * })
   * ```
   */
  static async applyRules(
    tx: PrismaTransaction,
    params: {
      userId: number
      currentPoints: number
      rules: Array<{
        ruleType: GrowthRuleTypeEnum
        remark?: string
        targetType?: number
        targetId?: number
      }>
    },
  ): Promise<PointApplyResult[]> {
    const { userId, currentPoints, rules } = params
    const results: PointApplyResult[] = []
    let runningPoints = currentPoints

    for (const rule of rules) {
      const result = await this.applyRule(tx, {
        userId,
        currentPoints: runningPoints,
        ruleType: rule.ruleType,
        remark: rule.remark,
        targetType: rule.targetType,
        targetId: rule.targetId,
      })

      if (result.applied && result.afterPoints !== undefined) {
        runningPoints = result.afterPoints
      }

      results.push(result)
    }

    return results
  }

  /**
   * 妫€鏌ョН鍒嗘槸鍚﹁冻澶燂紙涓嶆秷璐癸級
   */
  static checkSufficient(currentPoints: number, required: number): boolean {
    return currentPoints >= required
  }
}

/**
 * 鑾峰彇褰撳ぉ寮€濮嬫椂闂?
 */
function getStartOfDay(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}
```

#### 2.3.2 鎵╁睍绉垎瑙勫垯鏋氫妇

```typescript
// libs/user/src/growth-rule.constant.ts锛堜慨鏀癸級

export enum GrowthRuleTypeEnum {
  // 璁哄潧鐩稿叧
  CREATE_TOPIC = 1,
  CREATE_REPLY = 2,
  TOPIC_LIKED = 3,
  REPLY_LIKED = 4,
  TOPIC_FAVORITED = 5,
  DAILY_CHECK_IN = 6,
  ADMIN = 7,
  TOPIC_VIEW = 8,
  REPORT_CREATE = 9,

  // 璇勮鐩稿叧锛堟柊澧烇級
  /** 鍙戣〃璇勮 */
  CREATE_COMMENT = 10,
  /** 璇勮琚偣璧?*/
  COMMENT_LIKED = 11,
  /** 姣忔棩棣栬瘎濂栧姳 */
  FIRST_COMMENT_OF_DAY = 12,

  // 婕敾浣滃搧鐩稿叧
  COMIC_WORK_VIEW = 100,
  COMIC_WORK_LIKE = 101,
  COMIC_WORK_FAVORITE = 102,

  // 灏忚浣滃搧鐩稿叧
  NOVEL_WORK_VIEW = 200,
  NOVEL_WORK_LIKE = 201,
  NOVEL_WORK_FAVORITE = 202,

  // 婕敾绔犺妭鐩稿叧
  COMIC_CHAPTER_READ = 300,
  COMIC_CHAPTER_LIKE = 301,
  COMIC_CHAPTER_PURCHASE = 302,
  COMIC_CHAPTER_DOWNLOAD = 303,
  COMIC_CHAPTER_EXCHANGE = 304,
}

export const GrowthRuleTypeNames: Record<GrowthRuleTypeEnum, string> = {
  // ... 鍘熸湁鏄犲皠
  [GrowthRuleTypeEnum.CREATE_COMMENT]: '鍙戣〃璇勮',
  [GrowthRuleTypeEnum.COMMENT_LIKED]: '璇勮琚偣璧?,
  [GrowthRuleTypeEnum.FIRST_COMMENT_OF_DAY]: '姣忔棩棣栬瘎',
  // ...
}
```

---

## 涓夈€佷娇鐢ㄧず渚?

### 3.1 璇勮鏈嶅姟闆嗘垚

```typescript
// libs/interaction/src/comment/comment.service.ts

import { PointHelper } from '@libs/user'
import { GrowthRuleTypeEnum } from '@libs/user'

@Injectable()
export class CommentService extends BaseService {
  constructor(
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly configReader: ConfigReader,
    private readonly commentPermissionService: CommentPermissionService,
  ) {
    super()
  }

  /**
   * 鍒涘缓璇勮
   */
  async createComment(dto: CreateCommentDto) {
    const { userId, targetType, targetId, content } = dto

    // 1. 鏉冮檺妫€鏌ワ紙鍐呴儴宸叉煡璇㈢敤鎴凤級
    const permission = await this.commentPermissionService.ensureCanComment(
      userId,
      targetType,
      targetId,
    )

    // 2. 鏁忔劅璇嶅鏍?
    const decision = this.resolveAuditDecision(content)

    // 3. 璁＄畻妤煎眰
    const result = await this.prisma.userComment.aggregate({
      where: { targetType, targetId, replyToId: null },
      _max: { floor: true },
    })
    const floor = (result._max.floor ?? 0) + 1

    // 4. 浜嬪姟鍐呭垱寤鸿瘎璁?+ 搴旂敤绉垎
    return this.prisma.$transaction(async (tx) => {
      const newComment = await tx.userComment.create({
        data: {
          targetType,
          targetId,
          userId,
          content,
          floor,
          ...decision,
        },
      })

      // 鏇存柊鐩爣璇勮璁℃暟
      if (this.isVisible({ ...decision, deletedAt: null })) {
        await this.applyCommentCountDelta(tx, targetType, targetId, 1)

        // 搴旂敤绉垎瑙勫垯锛堟棤闇€棰濆鏌ヨ鐢ㄦ埛锛?
        await PointHelper.applyRule(tx, {
          userId,
          currentPoints: permission.user.points,
          ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
          remark: `鍙戣〃璇勮 #${newComment.id}`,
          targetType,
          targetId: newComment.id,
        })
      }

      return { id: newComment.id }
    })
  }

  /**
   * 鍒犻櫎璇勮
   */
  async deleteComment(commentId: number, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const where = userId ? { id: commentId, userId } : { id: commentId }
      const result = await tx.userComment.softDelete(where)

      if (!this.isVisible({ ...result, deletedAt: null })) {
        return { id: result.id }
      }

      await this.applyCommentCountDelta(
        tx,
        result.targetType as InteractionTargetTypeEnum,
        result.targetId,
        -1,
      )

      // 鍙€夛細鍒犻櫎璇勮鎵ｉ櫎绉垎
      // await PointHelper.consume(tx, {
      //   userId: result.userId,
      //   currentPoints: ???, // 闇€瑕佹煡璇㈠綋鍓嶇Н鍒?
      //   points: 5,
      //   remark: '鍒犻櫎璇勮',
      // })

      return { id: result.id }
    })
  }
}
```

### 3.2 璇勮鏉冮檺鏈嶅姟鏀归€?

```typescript
// libs/interaction/src/comment/comment-permission.service.ts

@Injectable()
export class CommentPermissionService {
  /**
   * 纭繚鐢ㄦ埛鍙互璇勮
   * @returns 杩斿洖鐢ㄦ埛淇℃伅锛屼緵鍚庣画澶嶇敤
   */
  async ensureCanComment(
    userId: number,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<{ user: { id: number; points: number; status: number } }> {
    // 鏌ヨ鐢ㄦ埛锛堣繑鍥炴暟鎹緵澶嶇敤锛?
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, points: true, status: true },
    })

    if (!user) {
      throw new NotFoundException('鐢ㄦ埛涓嶅瓨鍦?)
    }

    // 鍏朵粬鏉冮檺妫€鏌?..

    return { user }
  }
}
```

### 3.3 璇勮鐐硅禐闆嗘垚

```typescript
// libs/interaction/src/comment/comment-interaction.service.ts

import { PointHelper } from '@libs/user'
import { GrowthRuleTypeEnum } from '@libs/user'

@Injectable()
export class CommentInteractionService extends BaseService {
  /**
   * 鐐硅禐璇勮
   */
  async likeComment(commentId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.userComment.findUnique({
        where: { id: commentId, deletedAt: null },
        select: {
          id: true,
          userId: true,  // 璇勮浣滆€?
          likes: { where: { userId }, select: { id: true } },
        },
      })

      if (!comment) {
        throw new NotFoundException('璇勮涓嶅瓨鍦?)
      }
      if (comment.likes.length) {
        throw new BadRequestException('宸茬偣璧炶繃璇ヨ瘎璁?)
      }

      // 鍒涘缓鐐硅禐璁板綍
      await tx.userCommentLike.create({
        data: { commentId, userId },
      })

      // 鏇存柊鐐硅禐璁℃暟
      await tx.userComment.applyCountDelta({ id: commentId }, 'likeCount', 1)

      // 缁欒瘎璁轰綔鑰呭姞绉垎锛堥渶瑕佹煡璇綔鑰呭綋鍓嶇Н鍒嗭級
      const author = await tx.appUser.findUnique({
        where: { id: comment.userId },
        select: { id: true, points: true },
      })

      if (author) {
        await PointHelper.applyRule(tx, {
          userId: author.id,
          currentPoints: author.points,
          ruleType: GrowthRuleTypeEnum.COMMENT_LIKED,
          remark: `璇勮琚偣璧?#${commentId}`,
          targetId: commentId,
        })
      }

      return { id: commentId }
    })
  }
}
```

---

## 鍥涖€佷笌鐜版湁鏈嶅姟鐨勮亴璐ｅ垝鍒?

| 缁勪欢 | 鑱岃矗 | 鍏稿瀷鏂规硶 |
|------|------|----------|
| **PointHelper** | 浜嬪姟鍐呯Н鍒嗘搷浣滐紙宸ュ叿绫伙級 | `applyRule`, `consume` |
| **UserPointService** | 绉垎璁板綍鏌ヨ銆佺粺璁★紙鏈嶅姟锛?| `getPointRecordPage`, `getUserPointStats` |
| **UserPointRuleService** | 瑙勫垯閰嶇疆绠＄悊锛堟湇鍔★級 | `createPointRule`, `updatePointRule` |

---

## 浜斻€佹暟鎹簱鍙樻洿

### 5.1 鏂板绉垎瑙勫垯绉嶅瓙鏁版嵁

```typescript
// prisma/seed/modules/interaction/point-rule.ts

export const INTERACTION_POINT_RULES = [
  {
    type: 10, // CREATE_COMMENT
    points: 2,
    dailyLimit: 20,
    totalLimit: 0,
    isEnabled: true,
    remark: '鍙戣〃璇勮鑾峰緱绉垎锛屾瘡鏃ヤ笂闄?0娆?,
  },
  {
    type: 11, // COMMENT_LIKED
    points: 1,
    dailyLimit: 0,
    totalLimit: 0,
    isEnabled: true,
    remark: '璇勮琚偣璧炶幏寰楃Н鍒?,
  },
  {
    type: 12, // FIRST_COMMENT_OF_DAY
    points: 5,
    dailyLimit: 1,
    totalLimit: 0,
    isEnabled: true,
    remark: '姣忔棩棣栨璇勮棰濆濂栧姳',
  },
]
```

---

## 鍏€佸鍑洪厤缃?

```typescript
// libs/user/src/point/index.ts锛堜慨鏀癸級

export * from './point.constant'
export * from './point.helper'      // 鏂板瀵煎嚭
export * from './point.module'
export * from './point-rule.service'
export * from './point.service'
export * from './dto/point-record.dto'
export * from './dto/point-rule.dto'
```

---

## 涓冦€佷紭缂虹偣鎬荤粨

### 浼樼偣

1. **闆跺啑浣欐煡璇?*锛氱敤鎴锋暟鎹彧鏌ヨ涓€娆?
2. **浜嬪姟涓€鑷存€?*锛氱Н鍒嗘搷浣滀笌涓氬姟鍦ㄥ悓涓€浜嬪姟
3. **浣庤€﹀悎**锛氫笟鍔℃ā鍧楁棤闇€娉ㄥ叆绉垎鏈嶅姟
4. **鍙祴璇曟€?*锛氶潤鎬佹柟娉曟槗浜庡崟鍏冩祴璇?
5. **鐏垫椿鎬?*锛氳皟鐢ㄦ柟鍙牴鎹繑鍥炵粨鏋滃喅瀹氬悗缁鐞?

### 缂虹偣

1. **璋冪敤鏂硅亴璐ｅ鍔?*锛氶渶瑕佷紶鍏ュ綋鍓嶇Н鍒?
2. **浜嬪姟鏃堕棿鍙橀暱**锛氱Н鍒嗘搷浣滃湪涓氬姟浜嬪姟鍐?

### 閫傜敤鍦烘櫙

- 涓氬姟鎿嶄綔涓庣Н鍒嗗己鍏宠仈锛堝鍙戝笘銆佽瘎璁恒€佺偣璧烇級
- 闇€瑕佷簨鍔′竴鑷存€?
- 瀵规€ц兘鏁忔劅鐨勫満鏅?

### 涓嶉€傜敤鍦烘櫙

- 绉垎鎿嶄綔鍙紓姝ュ鐞?
- 涓嶉渶瑕佷笌涓氬姟鍚屼簨鍔?

---

## 鍏€佸疄鏂借鍒?

### 闃舵涓€锛氬熀纭€璁炬柦

1. 鍒涘缓 `PointHelper` 宸ュ叿绫?
2. 鎵╁睍 `GrowthRuleTypeEnum` 鏋氫妇
3. 娣诲姞璇勮鐩稿叧绉垎瑙勫垯绉嶅瓙鏁版嵁
4. 鏇存柊瀵煎嚭閰嶇疆

### 闃舵浜岋細璇勮妯″潡闆嗘垚

1. 鏀归€?`CommentPermissionService` 杩斿洖鐢ㄦ埛鏁版嵁
2. 淇敼 `CommentService.createComment` 闆嗘垚绉垎
3. 淇敼 `CommentInteractionService.likeComment` 闆嗘垚绉垎

### 闃舵涓夛細娓呯悊鏃т唬鐮?

1. 鏍囪 `growth-event` 妯″潡涓哄簾寮?
2. 璇勪及鍏朵粬妯″潡鏄惁闇€瑕佽縼绉诲埌宸ュ叿绫绘ā寮?

---

## 涔濄€佸緟纭闂

1. **鏄惁闇€瑕佹敮鎸佺Н鍒嗗洖婊氾紵** 渚嬪璇勮琚垹闄ゅ悗鎵ｉ櫎宸茶幏寰楃殑绉垎
2. **鏄惁闇€瑕佹敮鎸佹壒閲忕Н鍒嗭紵** 渚嬪绠＄悊鍛樼粰澶氫釜鐢ㄦ埛鍙戞斁绉垎
3. **缁忛獙鍊兼槸鍚﹂噰鐢ㄧ浉鍚屾ā寮忥紵** 鏄惁闇€瑕佸垱寤?`ExperienceHelper`
4. **璇勮瑙勫垯鐨勫叿浣撴暟鍊?*锛氱Н鍒嗗€笺€佹瘡鏃ヤ笂闄愮瓑閰嶇疆

---

## 鍗併€佽惤鍦拌繘搴︽洿鏂帮紙2026-03-07锛?
### 宸插畬鎴愶紙浠ｇ爜宸叉敹鍙ｏ級

1. `growth-event` 涓婚摼璺凡浠庝笟鍔℃ā鍧楃Щ闄わ紝缁熶竴鏀逛负 `growth-ledger + growth-reward` 鍗曡建鍐欏叆銆?2. 璇勮閾捐矾宸插鎺ョ粺涓€ Ledger锛岃瘎璁哄彂鏀剧Н鍒?缁忛獙璧板悓涓€濂楄鍒欎笌娴佹按妯″瀷銆?3. 璐拱閾捐矾宸叉敹鍙ｅ埌 Ledger锛岀Щ闄?`user_point_record` 鐩村啓璺緞銆?4. `growth-overview` 宸蹭竴骞朵笅绾匡細
   - 绉婚櫎 `apps/admin-api/src/modules/user-growth/overview/*`銆?   - `apps/admin-api/src/modules/user-growth/user-growth.module.ts` 涓嶅啀寮曞叆 `OverviewModule`銆?   - 绉婚櫎 `libs/user/src/growth-overview/*` 鍙?`libs/user/src/index.ts` 鐨勫搴斿鍑恒€?   - 娓呯悊 `apps/app-api/src/modules/user/user.service.ts` 鐨?`getUserGrowthOverview` 姝讳唬鐮併€?5. `pnpm type-check` 宸查€氳繃锛屽綋鍓嶆敼鍔ㄥ湪缂栬瘧灞傞潰鍙敤銆?
### 褰撳墠鏋舵瀯缁撹

1. 鏂版柟妗堜笉鍐嶄緷璧?`growth-event` 涓?`growth-overview` 鎵嶈兘瀹屾垚绉垎/缁忛獙鍙戞斁銆?2. 鍚庣画缁х画鎵╁睍璧勪骇绫诲瀷鏃讹紝寤鸿娌跨敤鈥滆鍒欏垽瀹?+ 缁熶竴 Ledger 娴佹按 + 涓氬姟渚х紪鎺掆€濇ā寮忥紝閬垮厤鍥炲埌鍙岃建鍐欏叆銆?
### 寰呬綘鍐崇瓥锛堜笉褰卞搷褰撳墠鍙敤鎬э級

1. 鏄惁鍦ㄤ笅涓€娆℃暟鎹簱杩佺Щ涓墿鐞嗗垹闄ゅ巻鍙叉棫琛紙鑻ョ‘璁や笉鍐嶅洖婊氾紝鍙洿鎺ュ垹锛夈€?2. 鏄惁鍦ㄧ鐞嗙琛ヤ竴涓柊鐨勨€淟edger 鑱氬悎瑙嗗浘鈥濇帴鍙ｏ紝鏇夸唬鏃х殑 `growth-overview` 椤甸潰鑳藉姏銆?

---

## 11. Implementation Status Update (2026-03-07)

### Completed in code

1. Deprecated `growth-event` chain has been removed from active business modules.
2. Reward writes are unified to `growth-ledger + growth-reward` single path.
3. Comment and purchase flows are already routed to Ledger-based writes.
4. `growth-overview` is fully offline:
   - Removed `apps/admin-api/src/modules/user-growth/overview/*`.
   - Removed `OverviewModule` import from `apps/admin-api/src/modules/user-growth/user-growth.module.ts`.
   - Removed `libs/user/src/growth-overview/*` and root re-export.
   - Removed dead method `getUserGrowthOverview` from app user service.
5. Build check passed: `pnpm type-check`.

### Current architecture note

1. New reward flow does not require `growth-event` or `growth-overview`.
2. Future asset types should keep the same pattern: rule evaluation + ledger write + orchestration at business layer.

### Decisions resolved

1. Rollback is explicitly disabled for legacy growth chain.
2. Legacy table cleanup is approved and should stay on single Ledger path.
3. If admin still needs overview UX, build it from Ledger aggregate query only.

---

## 12. Decision Lock (2026-03-07)

Confirmed by product/dev owner:

1. No rollback to legacy `growth-event` chain.
2. Keep single-write path only: `growth-ledger + growth-reward`.
3. Legacy tables are treated as deprecated and can be physically removed:
   - `user_growth_event`
   - `user_growth_event_archive`
   - `user_point_record`
   - `user_experience_record`
4. Legacy overview path is fully offline and should not be reintroduced.

