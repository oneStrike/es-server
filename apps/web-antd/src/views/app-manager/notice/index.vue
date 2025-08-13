<script setup lang="ts">
import { Page, useVbenModal } from '@vben/common-ui';

import EsModalForm from '#/components/es-modal-form/index.vue';

import { formSchema } from './shared';

const [Form, formApi] = useVbenModal({
  connectedComponent: EsModalForm,
  destroyOnClose: true,
});
</script>

<template>
  <Page>
    <t-card>
      <t-button theme="default" @click="formApi.open()">确定</t-button>
    </t-card>
    <Form :schema="formSchema" />
  </Page>
</template>
