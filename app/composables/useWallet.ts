import {
  connect,
  disconnect,
  getAccount,
  getConnectors,
  watchAccount,
  reconnect,
  sendTransaction,
  waitForTransactionReceipt,
  signMessage,
  sendCalls,
  getCallsStatus,
  type Config,
} from "@wagmi/core";
import type Privy from "@privy-io/js-sdk-core";

export function useWallet() {
  const { $wagmiConfig, $privy } = useNuxtApp();
  const config = $wagmiConfig as Config;
  const privy = $privy as InstanceType<typeof Privy>;

  const address = ref<`0x${string}` | undefined>();
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const isAuthenticated = ref(false);
  const privyUser = ref<any>(null);
  const ready = ref(false);

  const syncAccount = () => {
    const account = getAccount(config);
    address.value = account.address;
    isConnected.value = account.isConnected;
  };

  onMounted(async () => {
    try {
      await reconnect(config);
    } catch {}
    syncAccount();
    watchAccount(config, {
      onChange: () => syncAccount(),
    });
    ready.value = true;
  });

  // Wallet-based login (injected / walletconnect / coinbase)
  const connectWithWallet = async (type: "injected" | "walletconnect" | "coinbase") => {
    isConnecting.value = true;
    try {
      const connectors = getConnectors(config);
      let connector;

      if (type === "injected") {
        connector = connectors.find((c) => c.type === "injected");
      } else if (type === "walletconnect") {
        connector = connectors.find((c) => c.type === "walletConnect");
      } else if (type === "coinbase") {
        connector = connectors.find((c) => c.id === "coinbaseWalletSDK");
      }

      if (!connector) {
        throw new Error(`No ${type} connector available`);
      }

      await connect(config, { connector });
      syncAccount();

      if (!address.value) throw new Error("Wallet not connected");

      // Authenticate with Privy via SIWE
      await authenticateWithSiwe();
    } catch (err: any) {
      if (getAccount(config).isConnected) {
        await disconnect(config);
      }
      syncAccount();
      isAuthenticated.value = false;
      privyUser.value = null;
      throw err;
    } finally {
      isConnecting.value = false;
    }
  };

  // SIWE authentication helper
  const authenticateWithSiwe = async () => {
    if (!address.value) throw new Error("No address");

    const wallet = {
      address: address.value,
      chainId: "eip155:8453",
    };

    const { message } = await privy.auth.siwe.init(
      wallet,
      window.location.host,
      window.location.origin,
    );

    const signature = await signMessage(config, { message });
    const authUser = await privy.auth.siwe.loginWithSiwe(signature);
    privyUser.value = authUser.user;
    isAuthenticated.value = true;
  };

  // Email OTP - send code
  const sendEmailCode = async (email: string) => {
    await privy.auth.email.sendCode(email);
  };

  // Email OTP - verify code and login
  const verifyEmailCode = async (email: string, code: string) => {
    isConnecting.value = true;
    try {
      const authUser = await privy.auth.email.loginWithCode(email, code);
      privyUser.value = authUser.user;
      isAuthenticated.value = true;
    } finally {
      isConnecting.value = false;
    }
  };

  // OAuth login
  const loginWithOAuth = async (provider: string) => {
    const redirectUri = window.location.origin + "/auth/callback";
    const { url } = await privy.auth.oauth.generateURL(
      provider as any,
      redirectUri,
    );
    window.location.href = url;
  };

  // Handle OAuth callback
  const handleOAuthCallback = async (code: string, state: string) => {
    isConnecting.value = true;
    try {
      const authUser = await privy.auth.oauth.loginWithCode(code, state);
      privyUser.value = authUser.user;
      isAuthenticated.value = true;
    } finally {
      isConnecting.value = false;
    }
  };

  const disconnectWallet = async () => {
    try {
      await privy.auth.logout();
    } catch {
      // Ignore logout errors
    }
    privyUser.value = null;
    isAuthenticated.value = false;
    if (getAccount(config).isConnected) {
      await disconnect(config);
    }
    syncAccount();
  };

  const sendTx = async (tx: { to: `0x${string}`; data: `0x${string}`; value: bigint }) => {
    const hash = await sendTransaction(config, {
      to: tx.to,
      data: tx.data,
      value: tx.value,
    });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  };

  // Batch multiple txs — try EIP-5792 first, fallback to sequential
  const sendBatchTx = async (txs: { to: `0x${string}`; data: `0x${string}`; value: bigint }[]) => {
    if (txs.length === 0) return;
    if (txs.length === 1) return sendTx(txs[0]!);

    // Try EIP-5792 batch calls (supported by Coinbase Smart Wallet, etc.)
    try {
      const result = await sendCalls(config, {
        calls: txs.map((tx) => ({
          to: tx.to,
          data: tx.data,
          value: tx.value,
        })),
      });

      const callId = result.id;

      // Poll for completion
      let status = await getCallsStatus(config, { id: callId });
      while (status.status === "pending") {
        await new Promise((r) => setTimeout(r, 1500));
        status = await getCallsStatus(config, { id: callId });
      }

      if (status.status !== "success") {
        throw new Error("Batch transaction failed");
      }

      return status.receipts?.[0]?.transactionHash;
    } catch (e: any) {
      // If wallet doesn't support batch calls, send sequentially
      const isBatchUnsupported =
        e?.name === "MethodNotFoundRpcError" ||
        e?.message?.includes("wallet_sendCalls") ||
        e?.message?.includes("does not exist");

      if (!isBatchUnsupported) throw e;

      let lastHash: `0x${string}` | undefined;
      for (const tx of txs) {
        lastHash = await sendTx(tx);
      }
      return lastHash;
    }
  };

  return {
    ready,
    address,
    isConnected,
    isConnecting,
    isAuthenticated,
    privyUser,
    connectWithWallet,
    sendEmailCode,
    verifyEmailCode,
    loginWithOAuth,
    handleOAuthCallback,
    disconnectWallet,
    sendTx,
    sendBatchTx,
  };
}
