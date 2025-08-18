<script lang="ts" setup>
import type { EsModalFormProps } from './types';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { useBitMask } from '#/hooks/useBitmask';

defineOptions({
  name: 'EsModalForm',
});

const props = withDefaults(defineProps<EsModalFormProps>(), {
  record: () => ({}),
});

const sharedData = ref<Partial<EsModalFormProps>>({
  title: '',
});

const modalTitle = computed(() => {
  return Object.keys(sharedData.value).length > 0
    ? `编辑${sharedData.value?.title ?? ''}`
    : `新增${sharedData.value?.title ?? ''}`;
});

const [Modal, modalApi] = useVbenModal({
  onConfirm: () => formApi.submitForm(),
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      sharedData.value = modalApi.getData<EsModalFormProps>();

      if (sharedData.value?.record) {
        if (Array.isArray(sharedData.value?.bitMaskField)) {
          sharedData.value.bitMaskField.forEach((field) => {
            if (sharedData.value.record) {
              sharedData.value.record[field] = sharedData.value.record[field]
                ? useBitMask.split(sharedData.value.record[field])
                : [];
            }
          });
        }
        formApi.setValues(sharedData.value.record);
      }
    }
  },
});

const [BaseForm, formApi] = useVbenForm({
  layout: 'horizontal',
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
  fieldMappingTime: props.fieldMappingTime,

  handleSubmit: async (values) => {
    modalApi.lock();

    if (Array.isArray(sharedData.value.bitMaskField)) {
      sharedData.value.bitMaskField.forEach((field) => {
        if (values[field]) {
          values[field] = useBitMask.set(values[field]);
        }
      });
    }

    await props.onSubmit?.({
      ...values,
      id: sharedData.value?.record?.id,
    });
    modalApi.unlock();
  },
  schema: props.schema,
});
</script>
<template>
  <Modal :title="modalTitle" :class="`w-[${sharedData?.width ?? 1000}px]`">
    <template #prepend-footer>
      <el-button @click="formApi.resetForm()">重置</el-button>
    </template>
    <BaseForm />
  </Modal>
</template>
