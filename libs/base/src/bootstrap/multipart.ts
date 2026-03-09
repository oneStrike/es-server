import type { UploadConfigInterface } from '@libs/base/config'
import type { AppConfigInterface } from '@libs/base/types'
import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { mkdir } from 'node:fs/promises'
import { extname } from 'node:path'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { ConfigService } from '@nestjs/config'

const EXT_LEADING_DOT_REGEX = /^\./

export async function setupMultipart(
  fastifyAdapter: FastifyAdapter,
  app: NestFastifyApplication,
) {
  const configService = app.get(ConfigService)
  const uploadConfig = configService.get<UploadConfigInterface>('upload')!
  const appConfig = configService.get<AppConfigInterface>('app')!

  // 绾喕绻氭稉濠佺炊閻╊喖缍嶇€涙ê婀敍鍫濇躬閹稿倽娴囬惃鍕問娑撶粯婧€閻╊喖缍嶆稉瀣偓鎺戠秺閸掓稑缂撻敍?
  await mkdir(uploadConfig.uploadDir, { recursive: true })

  // 濞夈劌鍞介棃娆愨偓浣规瀮娴犺埖婀囬崝?
  await fastifyAdapter.register(fastifyStatic, {
    root: uploadConfig.uploadDir,
    prefix: appConfig.fileUrlPrefix,
    index: false,
    dotfiles: 'deny',
    etag: true,
    cacheControl: true,
    maxAge: '1h',
    // 闁藉牆顕弬鍥ㄣ€傛稉搴″竾缂傗晛瀵樼猾璇茬€峰鍝勫煑娴犮儵妾禒鑸垫煙瀵繋绗呮潪鏂ょ礉闂勫秳缍?XSS 妞嬪酣娅?
    setHeaders(res: any, filePath: string) {
      try {
        const { document, archive } = uploadConfig.allowExtensions
        const ext = extname(filePath).toLowerCase().replace(EXT_LEADING_DOT_REGEX, '')
        const isDoc = document?.includes(ext)
        const isArchive = archive?.includes(ext)
        if (isDoc || isArchive) {
          res.setHeader('Content-Disposition', 'attachment')
          res.setHeader('X-Content-Type-Options', 'nosniff')
        }
      } catch {}
    },
  })

  // 濞夈劌鍞絤ultipart閹绘帊娆?
  await fastifyAdapter.register(fastifyMultipart, {
    // 閸氼垳鏁ら弬鍥︽婢堆冪毈闂勬劕鍩楀鍌氱埗閹舵稑鍤?
    throwFileSizeLimit: true,
    // 閸忋劌鐪弬鍥︽婢堆冪毈闂勬劕鍩楅敍宀€娲块幒銉ょ炊闁帞绮伴幓鎺嶆
    fileSize: uploadConfig.maxFileSize,
    // 閸忔湹绮梽鎰煑闁板秶鐤?
    limits: {
      fieldNameSize: 100, // 鐎涙顔岄崥宥囆為張鈧径褔鏆辨惔?
      fieldSize: 100 * 1024, // 鐎涙顔岄崐鍏兼付婢堆囨毐鎼?(100KB)
      fields: 10, // 閺堚偓婢堆冪摟濞堝灚鏆熼柌?
      files: 1, // 閺堚偓婢堆勬瀮娴犺埖鏆熼柌蹇ョ礉閸楁洘鏋冩禒鑸的佸?
      parts: 1000, // 閺堚偓婢额湺art閺佷即鍣?
      fileSize: uploadConfig.maxFileSize, // 绾喕绻氶崷鈺╥mits鐎电钖勬稉顓濈瘍鐠佸墽鐤嗛弬鍥︽婢堆冪毈闂勬劕鍩?
    },
  })
}
