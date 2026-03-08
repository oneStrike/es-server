import { Injectable } from '@nestjs/common'

@Injectable()
export class ViewInteractionService {
  async handleViewRecorded(): Promise<void> {
    // 预留给后续埋点或联动逻辑
  }
}
