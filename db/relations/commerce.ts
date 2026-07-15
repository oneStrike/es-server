import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

export const commerceRelations = defineRelationsPart(schema, (r) => ({
  userAssetBalance: {
    user: r.one.appUser({
      from: r.userAssetBalance.userId,
      to: r.appUser.id,
    }),
  },
  membershipPlan: {
    subscriptions: r.many.userMembershipSubscription(),
    benefits: r.many.membershipPlanBenefit(),
    pageConfigs: r.many.membershipPageConfig({
      from: r.membershipPlan.id.through(r.membershipPageConfigPlan.planId),
      to: r.membershipPageConfig.id.through(
        r.membershipPageConfigPlan.pageConfigId,
      ),
    }),
  },
  membershipPageConfig: {
    agreements: r.many.appAgreement({
      from: r.membershipPageConfig.id.through(
        r.membershipPageConfigAgreement.pageConfigId,
      ),
      to: r.appAgreement.id.through(
        r.membershipPageConfigAgreement.agreementId,
      ),
    }),
    plans: r.many.membershipPlan({
      from: r.membershipPageConfig.id.through(
        r.membershipPageConfigPlan.pageConfigId,
      ),
      to: r.membershipPlan.id.through(r.membershipPageConfigPlan.planId),
    }),
  },
  membershipPageConfigAgreement: {
    pageConfig: r.one.membershipPageConfig({
      from: r.membershipPageConfigAgreement.pageConfigId,
      to: r.membershipPageConfig.id,
    }),
    agreement: r.one.appAgreement({
      from: r.membershipPageConfigAgreement.agreementId,
      to: r.appAgreement.id,
    }),
  },
  membershipPageConfigPlan: {
    pageConfig: r.one.membershipPageConfig({
      from: r.membershipPageConfigPlan.pageConfigId,
      to: r.membershipPageConfig.id,
    }),
    plan: r.one.membershipPlan({
      from: r.membershipPageConfigPlan.planId,
      to: r.membershipPlan.id,
    }),
  },
  membershipBenefitDefinition: {
    planBenefits: r.many.membershipPlanBenefit(),
  },
  membershipPlanBenefit: {
    plan: r.one.membershipPlan({
      from: r.membershipPlanBenefit.planId,
      to: r.membershipPlan.id,
    }),
    benefit: r.one.membershipBenefitDefinition({
      from: r.membershipPlanBenefit.benefitId,
      to: r.membershipBenefitDefinition.id,
    }),
  },
  userMembershipSubscription: {
    user: r.one.appUser({
      from: r.userMembershipSubscription.userId,
      to: r.appUser.id,
    }),
    plan: r.one.membershipPlan({
      from: r.userMembershipSubscription.planId,
      to: r.membershipPlan.id,
    }),
  },
  paymentProviderConfig: {
    orders: r.many.paymentOrder(),
    versions: r.many.paymentProviderConfigVersion(),
  },
  paymentProviderConfigVersion: {
    providerConfig: r.one.paymentProviderConfig({
      from: r.paymentProviderConfigVersion.providerConfigId,
      to: r.paymentProviderConfig.id,
    }),
    orders: r.many.paymentOrder(),
    appPrivateCredential: r.one.paymentProviderCredential({
      from: r.paymentProviderConfigVersion.appPrivateCredentialId,
      to: r.paymentProviderCredential.id,
      alias: 'PaymentProviderConfigVersionAppPrivateCredential',
    }),
    alipayPublicCredential: r.one.paymentProviderCredential({
      from: r.paymentProviderConfigVersion.alipayPublicCredentialId,
      to: r.paymentProviderCredential.id,
      alias: 'PaymentProviderConfigVersionAlipayPublicCredential',
    }),
    wechatApiV3Credential: r.one.paymentProviderCredential({
      from: r.paymentProviderConfigVersion.wechatApiV3CredentialId,
      to: r.paymentProviderCredential.id,
      alias: 'PaymentProviderConfigVersionWechatApiV3Credential',
    }),
    appCertificate: r.one.paymentProviderCertificate({
      from: r.paymentProviderConfigVersion.appCertificateId,
      to: r.paymentProviderCertificate.id,
      alias: 'PaymentProviderConfigVersionAppCertificate',
    }),
    platformCertificate: r.one.paymentProviderCertificate({
      from: r.paymentProviderConfigVersion.platformCertificateId,
      to: r.paymentProviderCertificate.id,
      alias: 'PaymentProviderConfigVersionPlatformCertificate',
    }),
    rootCertificate: r.one.paymentProviderCertificate({
      from: r.paymentProviderConfigVersion.rootCertificateId,
      to: r.paymentProviderCertificate.id,
      alias: 'PaymentProviderConfigVersionRootCertificate',
    }),
  },
  paymentProviderCredential: {
    appPrivateCredentialOrders: r.many.paymentOrder({
      from: r.paymentProviderCredential.id,
      to: r.paymentOrder.appPrivateCredentialId,
      alias: 'PaymentOrderAppPrivateCredential',
    }),
    alipayPublicCredentialOrders: r.many.paymentOrder({
      from: r.paymentProviderCredential.id,
      to: r.paymentOrder.alipayPublicCredentialId,
      alias: 'PaymentOrderAlipayPublicCredential',
    }),
    wechatApiV3CredentialOrders: r.many.paymentOrder({
      from: r.paymentProviderCredential.id,
      to: r.paymentOrder.wechatApiV3CredentialId,
      alias: 'PaymentOrderWechatApiV3Credential',
    }),
    appPrivateCredentialVersions: r.many.paymentProviderConfigVersion({
      from: r.paymentProviderCredential.id,
      to: r.paymentProviderConfigVersion.appPrivateCredentialId,
      alias: 'PaymentProviderConfigVersionAppPrivateCredential',
    }),
    alipayPublicCredentialVersions: r.many.paymentProviderConfigVersion({
      from: r.paymentProviderCredential.id,
      to: r.paymentProviderConfigVersion.alipayPublicCredentialId,
      alias: 'PaymentProviderConfigVersionAlipayPublicCredential',
    }),
    wechatApiV3CredentialVersions: r.many.paymentProviderConfigVersion({
      from: r.paymentProviderCredential.id,
      to: r.paymentProviderConfigVersion.wechatApiV3CredentialId,
      alias: 'PaymentProviderConfigVersionWechatApiV3Credential',
    }),
  },
  paymentProviderCertificate: {
    appCertificateVersions: r.many.paymentProviderConfigVersion({
      from: r.paymentProviderCertificate.id,
      to: r.paymentProviderConfigVersion.appCertificateId,
      alias: 'PaymentProviderConfigVersionAppCertificate',
    }),
    platformCertificateVersions: r.many.paymentProviderConfigVersion({
      from: r.paymentProviderCertificate.id,
      to: r.paymentProviderConfigVersion.platformCertificateId,
      alias: 'PaymentProviderConfigVersionPlatformCertificate',
    }),
    rootCertificateVersions: r.many.paymentProviderConfigVersion({
      from: r.paymentProviderCertificate.id,
      to: r.paymentProviderConfigVersion.rootCertificateId,
      alias: 'PaymentProviderConfigVersionRootCertificate',
    }),
  },
  paymentOrder: {
    user: r.one.appUser({
      from: r.paymentOrder.userId,
      to: r.appUser.id,
    }),
    providerConfig: r.one.paymentProviderConfig({
      from: r.paymentOrder.providerConfigId,
      to: r.paymentProviderConfig.id,
    }),
    providerConfigVersionRecord: r.one.paymentProviderConfigVersion({
      from: r.paymentOrder.providerConfigVersionId,
      to: r.paymentProviderConfigVersion.id,
    }),
    appPrivateCredential: r.one.paymentProviderCredential({
      from: r.paymentOrder.appPrivateCredentialId,
      to: r.paymentProviderCredential.id,
      alias: 'PaymentOrderAppPrivateCredential',
    }),
    alipayPublicCredential: r.one.paymentProviderCredential({
      from: r.paymentOrder.alipayPublicCredentialId,
      to: r.paymentProviderCredential.id,
      alias: 'PaymentOrderAlipayPublicCredential',
    }),
    wechatApiV3Credential: r.one.paymentProviderCredential({
      from: r.paymentOrder.wechatApiV3CredentialId,
      to: r.paymentProviderCredential.id,
      alias: 'PaymentOrderWechatApiV3Credential',
    }),
    notifyEvents: r.many.paymentNotifyEvent(),
    reconciliationRecords: r.many.paymentReconciliationRecord(),
  },
  paymentNotifyEvent: {
    order: r.one.paymentOrder({
      from: r.paymentNotifyEvent.paymentOrderId,
      to: r.paymentOrder.id,
    }),
  },
  paymentReconciliationRecord: {
    order: r.one.paymentOrder({
      from: r.paymentReconciliationRecord.paymentOrderId,
      to: r.paymentOrder.id,
    }),
  },
  couponDefinition: {
    instances: r.many.userCouponInstance(),
    adminGrantJobs: r.many.couponAdminGrantJob(),
  },
  couponAdminGrantJob: {
    workflowJob: r.one.workflowJob({
      from: r.couponAdminGrantJob.workflowJobId,
      to: r.workflowJob.id,
    }),
    couponDefinition: r.one.couponDefinition({
      from: r.couponAdminGrantJob.couponDefinitionId,
      to: r.couponDefinition.id,
    }),
    operator: r.one.adminUser({
      from: r.couponAdminGrantJob.operatorUserId,
      to: r.adminUser.id,
      alias: 'CouponAdminGrantOperator',
    }),
    items: r.many.couponAdminGrantItem(),
  },
  couponAdminGrantItem: {
    job: r.one.couponAdminGrantJob({
      from: r.couponAdminGrantItem.couponAdminGrantJobId,
      to: r.couponAdminGrantJob.id,
    }),
    user: r.one.appUser({
      from: r.couponAdminGrantItem.userId,
      to: r.appUser.id,
    }),
  },
  userCouponInstance: {
    user: r.one.appUser({
      from: r.userCouponInstance.userId,
      to: r.appUser.id,
    }),
    definition: r.one.couponDefinition({
      from: r.userCouponInstance.couponDefinitionId,
      to: r.couponDefinition.id,
    }),
    redemptionRecords: r.many.couponRedemptionRecord(),
    purchaseRecords: r.many.userPurchaseRecord({
      from: r.userCouponInstance.id,
      to: r.userPurchaseRecord.couponInstanceId,
    }),
  },
  couponRedemptionRecord: {
    user: r.one.appUser({
      from: r.couponRedemptionRecord.userId,
      to: r.appUser.id,
    }),
    couponInstance: r.one.userCouponInstance({
      from: r.couponRedemptionRecord.couponInstanceId,
      to: r.userCouponInstance.id,
    }),
  },
}))
