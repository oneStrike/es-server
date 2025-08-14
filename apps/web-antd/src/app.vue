<script lang="ts" setup>
import { useTDesignDesignTokens } from '@vben/hooks';

defineOptions({ name: 'App' });

useTDesignDesignTokens();
</script>

<template>
  <t-config-provider>
    <RouterView />
  </t-config-provider>
</template>
