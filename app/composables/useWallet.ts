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
import { base } from "viem/chains";
import type Privy from "@privy-io/js-sdk-core";
import { getUserEmbeddedEthereumWallet } from "@privy-io/js-sdk-core";

export function useWallet() {
  const { $wagmiConfig, $privy } = useNuxtApp();
  const config = $wagmiConfig as Config;
  const privy = $privy as InstanceType<typeof Privy>;

  // Use useState so state is shared across pages/components
  const address = useState<`0x${string}` | undefined>("wallet:address", () => undefined);
  const isConnected = useState("wallet:isConnected", () => false);
  const isConnecting = useState("wallet:isConnecting", () => false);
  const isAuthenticated = useState("wallet:isAuthenticated", () => false);
  const privyUser = useState<any>("wallet:privyUser", () => null);
  const ready = useState("wallet:ready", () => false);

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

    // Restore Privy session if one exists (e.g., after OAuth redirect)
    if (!isAuthenticated.value) {
      try {
        const { user } = await privy.user.get();
        if (user) {
          privyUser.value = user;
          isAuthenticated.value = true;
          // Ensure embedded wallet exists and set address for social login users
          if (!address.value) {
            await ensureEmbeddedWallet(user);
          }
        }
      } catch {
        // No active session
      }
    } else if (!address.value && privyUser.value) {
      // Already authenticated but no address (e.g., navigated from callback)
      await ensureEmbeddedWallet(privyUser.value);
    }

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

      // Authenticate with Privy via SIWE (non-fatal — wallet stays connected even if Privy fails)
      try {
        await authenticateWithSiwe();
      } catch (siweErr: any) {
        console.warn("Privy SIWE auth failed, continuing with wallet only:", siweErr.message);
        isAuthenticated.value = false;
        privyUser.value = null;
      }
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

  // Ensure embedded wallet exists for social/email login users and set address
  const ensureEmbeddedWallet = async (user: any) => {
    let embeddedWallet = getUserEmbeddedEthereumWallet(user);
    if (!embeddedWallet) {
      // Create an embedded wallet for this user
      const result = await privy.embeddedWallet.create({});
      privyUser.value = result.user;
      embeddedWallet = getUserEmbeddedEthereumWallet(result.user);
    }
    if (embeddedWallet?.address) {
      address.value = embeddedWallet.address as `0x${string}`;
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
      await ensureEmbeddedWallet(authUser.user);
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
      await ensureEmbeddedWallet(authUser.user);
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
      chainId: base.id,
      to: tx.to,
      data: tx.data,
      value: tx.value,
    });
    await waitForTransactionReceipt(config, { hash, chainId: base.id });
    return hash;
  };

  // Batch multiple txs — try EIP-5792 first, fallback to sequential
  const sendBatchTx = async (txs: { to: `0x${string}`; data: `0x${string}`; value: bigint }[]) => {
    if (txs.length === 0) return;
    if (txs.length === 1) return sendTx(txs[0]!);

    // Try EIP-5792 batch calls (supported by Coinbase Smart Wallet, etc.)
    try {
      const result = await sendCalls(config, {
        chainId: base.id,
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
