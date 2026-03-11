import Privy, { LocalStorage } from "@privy-io/js-sdk-core";

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig();

  const privy = new Privy({
    appId: config.public.privyAppId as string,
    clientId: config.public.privyClientId as string,
    storage: new LocalStorage(),
  });

  await privy.initialize();

  return {
    provide: {
      privy,
    },
  };
});
