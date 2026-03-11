import { createConfig, http } from "@wagmi/core";
import { injected, walletConnect, coinbaseWallet } from "@wagmi/connectors";
import { base } from "viem/chains";

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig();
  const projectId = runtimeConfig.public.walletconnectProjectId as string;

  const connectors = [
    injected(),
    coinbaseWallet({ appName: "Fynex", preference: { options: "smartWalletOnly" } }),
  ];

  if (projectId) {
    connectors.push(walletConnect({ projectId, showQrModal: true }));
  }

  const config = createConfig({
    chains: [base],
    connectors,
    transports: {
      [base.id]: http("https://base-mainnet.public.blastapi.io"),
    },
  });

  return {
    provide: {
      wagmiConfig: config,
    },
  };
});
