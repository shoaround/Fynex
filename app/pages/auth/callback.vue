<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const { handleOAuthCallback } = useWallet();

onMounted(async () => {
  const code = route.query.code as string;
  const state = route.query.state as string;

  if (code && state) {
    try {
      await handleOAuthCallback(code, state);
    } catch (e) {
      console.error("OAuth callback error:", e);
    }
  }

  router.replace("/app");
});
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center">
    <p class="text-muted-foreground">Authenticating...</p>
  </div>
</template>
