<script setup lang="ts">
import { Toaster } from "vue-sonner";

import "vue-sonner/style.css"; // vue-sonner v2 requires this import
</script>

<template>
	<NuxtPage />
	<Toaster position="top-center" :theme="'dark'" rich-colors />
</template>
