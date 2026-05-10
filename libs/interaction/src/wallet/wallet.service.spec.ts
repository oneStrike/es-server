/// <reference types="jest" />

import { BusinessException } from '@libs/platform/exceptions'
import { WalletService } from './wallet.service'
import { READING_COIN_ASSET_KEY } from './wallet.constant'

describe('WalletService domain split contract', () => {
  it('spends reading coin through the wallet owner for purchase transactions', async () => {
    const growthLedgerService = {
      applyDelta: jest.fn(() => Promise.resolve({ success: true })),
    }
    const service = new WalletService(
      {} as any,
      growthLedgerService as any,
      {} as any,
    )
    const tx = {}

    await service.consumeForPurchase(tx as any, {
      amount: 27,
      outTradeNo: 'seed-order',
      paymentMethod: 1,
      purchaseId: 11,
      targetId: 22,
      targetType: 1,
      userId: 33,
    })

    expect(growthLedgerService.applyDelta).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 2,
        amount: 27,
        assetKey: READING_COIN_ASSET_KEY,
        assetType: 4,
        bizKey: 'purchase:11:consume',
        source: 'purchase',
      }),
    )
  })

  it('maps insufficient balance from ledger rejection to a business exception', async () => {
    const growthLedgerService = {
      applyDelta: jest.fn(() =>
        Promise.resolve({ reason: 'insufficient_balance', success: false }),
      ),
    }
    const service = new WalletService(
      {} as any,
      growthLedgerService as any,
      {} as any,
    )

    await expect(
      service.consumeForPurchase({} as any, {
        amount: 99,
        paymentMethod: 1,
        purchaseId: 1,
        targetId: 2,
        targetType: 1,
        userId: 3,
      }),
    ).rejects.toBeInstanceOf(BusinessException)
  })
})
