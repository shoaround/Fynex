import { createYoClient, VAULTS, YO_GATEWAY_ADDRESS, type VaultSnapshot, type UserVaultPosition, type MerklChainRewards, type SharePriceHistoryPoint, type UserHistoryItem, type PreparedTransaction } from "@yo-protocol/core";
import { createPublicClient, http, formatUnits, parseUnits, encodeFunctionData, erc20Abi, maxUint256 } from "viem";
import { base } from "viem/chains";
import { VAULT_DEFS, CHAIN_ID, type VaultAllocation, type VaultDef } from "~/config/fund";

const WETH_ADDRESS = "0x4200000000000000000000000000000000000006" as `0x${string}`;
const NATIVE_ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://base-mainnet.public.blastapi.io", {
    batch: true,
    retryCount: 3,
    retryDelay: 1000,
  }),
});

const yo = createYoClient({
  chainId: CHAIN_ID,
  publicClients: { [CHAIN_ID]: publicClient as any },
});

export type VaultPerf = {
  unrealized: { raw: string | number; formatted: string };
  realized: { raw: string | number; formatted: string };
};

export type VaultInfo = VaultDef & {
  snapshot: VaultSnapshot | null;
  position: UserVaultPosition | null;
  performance: VaultPerf | null;
};

export function useYoProtocol() {
  const vaults = ref<VaultInfo[]>([]);
  const prices = ref<Record<string, number>>({});
  const loading = ref(false);
  const txStatus = ref<string | null>(null);

  const fetchVaultData = async (userAddress?: `0x${string}`) => {
    loading.value = true;
    try {
      // Fetch prices first (separate API, no RPC)
      const priceMap = await yo.getPrices().catch(() => ({} as Record<string, number>));
      prices.value = priceMap;

      // Fetch vaults sequentially to avoid RPC rate limits
      const data: VaultInfo[] = [];
      for (const def of VAULT_DEFS) {
        let snapshot: VaultSnapshot | null = null;
        let position: UserVaultPosition | null = null;
        let performance: VaultPerf | null = null;

        try {
          snapshot = await yo.getVaultSnapshot(def.address);
        } catch (e) {
          console.error(`Snapshot error ${def.label}:`, e);
        }

        if (userAddress) {
          try {
            position = await yo.getUserPosition(def.address, userAddress);
          } catch (e) {
            console.error(`Position error ${def.label}:`, e);
          }

          try {
            performance = await yo.getUserPerformance(def.address, userAddress);
          } catch (e) {
            console.error(`Performance error ${def.label}:`, e);
          }
        }

        data.push({ ...def, snapshot, position, performance });
      }
      vaults.value = data;
    } finally {
      loading.value = false;
    }
  };

  const computeWeightedApy = (allocations: VaultAllocation[]) => {
    let weighted = 0;
    for (const alloc of allocations) {
      const vault = vaults.value.find((v) => v.vaultId === alloc.vaultId);
      const apy = Number(vault?.snapshot?.stats?.yield?.["30d"] ?? 0);
      weighted += (apy * alloc.percentage) / 100;
    }
    return weighted;
  };

  const hasPositions = computed(() =>
    vaults.value.some((v) => v.position && v.position.shares > 0n)
  );

  type TxData = { to: `0x${string}`; data: `0x${string}`; value: bigint };

  // Helper: build a max-approval tx only if current allowance is insufficient
  const ensureAllowance = async (
    token: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
    minAmount: bigint,
  ): Promise<TxData | null> => {
    const allowance = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
    });
    if (allowance >= minAmount) return null;
    return {
      to: token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, maxUint256],
      }),
      value: 0n,
    };
  };

  const prepareDeposits = async (
    amount: string,
    allocations: VaultAllocation[],
    userAddress: `0x${string}`,
    sendBatchTx: (txs: TxData[]) => Promise<`0x${string}` | undefined>,
    inputToken?: { address: string; decimals: number; symbol: string }
  ) => {
    txStatus.value = "Preparing deposit transactions...";
    const { getRoute, getApproval } = useEnso();

    try {
      const activeAllocations = allocations.filter((a) => a.percentage > 0);
      const inputAddr = (inputToken?.address ?? activeAllocations[0]?.address) as `0x${string}`;
      const inputDecimals = inputToken?.decimals ?? activeAllocations[0]?.underlyingDecimals ?? 18;
      const inputSymbol = inputToken?.symbol ?? activeAllocations[0]?.underlyingSymbol ?? "Token";
      const isNative = inputAddr.toLowerCase() === NATIVE_ETH;
      const totalParsed = parseUnits(String(amount), inputDecimals);

      // Collect all txs into one batch
      const batch: TxData[] = [];

      // Track tokens we've already queued approval for (avoid duplicate approvals)
      const approvedTokens = new Set<string>();

      // 1. Approval for Enso router (if ERC20 input)
      if (!isNative && inputToken) {
        txStatus.value = `Checking ${inputSymbol} approval...`;
        try {
          const approval = await getApproval({
            fromAddress: userAddress,
            tokenAddress: inputAddr,
            amount: totalParsed.toString(),
          });
          if (approval.tx) {
            batch.push({
              to: approval.tx.to as `0x${string}`,
              data: approval.tx.data as `0x${string}`,
              value: BigInt(approval.tx.value || "0"),
            });
          }
        } catch {
          // Already approved
        }
      }

      // 2. Build route/deposit txs for each vault
      for (const alloc of activeAllocations) {
        const fraction = Number(amount) * (alloc.percentage / 100);
        if (fraction <= 0) continue;

        const underlyingAddress = (VAULTS as any)[alloc.vaultId]?.underlying?.address?.[CHAIN_ID] as `0x${string}` | undefined;
        if (!underlyingAddress) continue;

        const currentInputAddr = (inputToken?.address ?? underlyingAddress) as `0x${string}`;
        const currentInputDecimals = inputToken?.decimals ?? alloc.underlyingDecimals;
        const fractionFixed = parseFloat(fraction.toFixed(currentInputDecimals));
        const parsedAmount = parseUnits(fractionFixed.toString(), currentInputDecimals);
        const isSameToken = currentInputAddr.toLowerCase() === underlyingAddress.toLowerCase();

        if (parsedAmount === 0n) continue;

        txStatus.value = `Preparing ${alloc.label}...`;

        try {
          if (isSameToken) {
            // Ensure Gateway approval for this underlying token (once per token)
            const tokenKey = underlyingAddress.toLowerCase();
            if (!approvedTokens.has(tokenKey)) {
              const approveTx = await ensureAllowance(underlyingAddress, userAddress, YO_GATEWAY_ADDRESS, totalParsed);
              if (approveTx) batch.push(approveTx);
              approvedTokens.add(tokenKey);
            }
            // Direct deposit via yo-protocol (without approval — we handled it above)
            const depositTx = await yo.prepareDeposit({
              vault: alloc.address,
              recipient: userAddress,
              amount: parsedAmount,
              slippageBps: 100,
            });
            batch.push({ to: depositTx.to as `0x${string}`, data: depositTx.data as `0x${string}`, value: depositTx.value });
          } else {
            // Route directly to vault token via Enso (swap+deposit in 1 tx)
            try {
              const route = await getRoute({
                fromAddress: userAddress,
                tokenIn: currentInputAddr,
                tokenOut: alloc.address,
                amountIn: parsedAmount.toString(),
              });
              batch.push({
                to: route.tx.to as `0x${string}`,
                data: route.tx.data as `0x${string}`,
                value: BigInt(route.tx.value || "0"),
              });
            } catch {
              // Fallback: route to underlying, then deposit
              const isNativeInput = currentInputAddr.toLowerCase() === NATIVE_ETH;
              const isWethUnderlying = underlyingAddress.toLowerCase() === WETH_ADDRESS.toLowerCase();

              if (isNativeInput && isWethUnderlying) {
                // ETH → WETH wrap
                batch.push({
                  to: WETH_ADDRESS,
                  data: encodeFunctionData({
                    abi: [{ name: "deposit", type: "function", inputs: [], outputs: [], stateMutability: "payable" }],
                    functionName: "deposit",
                  }),
                  value: parsedAmount,
                });
                // Ensure Gateway approval for WETH
                const tokenKey = underlyingAddress.toLowerCase();
                if (!approvedTokens.has(tokenKey)) {
                  const approveTx = await ensureAllowance(underlyingAddress, userAddress, YO_GATEWAY_ADDRESS, parsedAmount);
                  if (approveTx) batch.push(approveTx);
                  approvedTokens.add(tokenKey);
                }
                // Deposit WETH into vault
                const depositTx = await yo.prepareDeposit({
                  vault: alloc.address,
                  recipient: userAddress,
                  amount: parsedAmount,
                  slippageBps: 100,
                });
                batch.push({ to: depositTx.to as `0x${string}`, data: depositTx.data as `0x${string}`, value: depositTx.value });
              } else {
                // Swap to underlying via Enso
                const route = await getRoute({
                  fromAddress: userAddress,
                  tokenIn: currentInputAddr,
                  tokenOut: underlyingAddress,
                  amountIn: parsedAmount.toString(),
                });
                batch.push({
                  to: route.tx.to as `0x${string}`,
                  data: route.tx.data as `0x${string}`,
                  value: BigInt(route.tx.value || "0"),
                });
                // Ensure Gateway approval for swapped underlying
                const tokenKey = underlyingAddress.toLowerCase();
                if (!approvedTokens.has(tokenKey)) {
                  const depositAmount = BigInt(route.amountOut) * 98n / 100n;
                  const approveTx = await ensureAllowance(underlyingAddress, userAddress, YO_GATEWAY_ADDRESS, depositAmount);
                  if (approveTx) batch.push(approveTx);
                  approvedTokens.add(tokenKey);
                }
                // Deposit the swapped amount (with slippage buffer)
                const depositAmount = BigInt(route.amountOut) * 98n / 100n;
                const depositTx = await yo.prepareDeposit({
                  vault: alloc.address,
                  recipient: userAddress,
                  amount: depositAmount,
                  slippageBps: 100,
                });
                batch.push({ to: depositTx.to as `0x${string}`, data: depositTx.data as `0x${string}`, value: depositTx.value });
              }
            }
          }
        } catch (e: any) {
          console.error(`Failed to prepare ${alloc.label}:`, e);
          txStatus.value = `Failed to prepare ${alloc.label}: ${e.shortMessage || e.message}`;
        }
      }

      if (batch.length === 0) {
        txStatus.value = "No transactions to send";
        return;
      }

      // 3. Send everything in one batch — single user confirmation
      txStatus.value = `Confirm ${batch.length} transactions in your wallet...`;
      await sendBatchTx(batch);

      txStatus.value = "Stash created!";
      await fetchVaultData(userAddress);
      setTimeout(() => { if (txStatus.value === "Stash created!") txStatus.value = null; }, 4000);
    } catch (e: any) {
      console.error("Deposit failed:", e);
      txStatus.value = `Error: ${e.shortMessage || e.message}`;
    }
  };

  const withdrawAll = async (
    userAddress: `0x${string}`,
    sendBatchTx: (txs: TxData[]) => Promise<`0x${string}` | undefined>
  ) => {
    txStatus.value = "Preparing withdrawals...";

    try {
      const batch: TxData[] = [];

      // 1. Collect all vault shares that need approval, then batch approvals
      const vaultsToRedeem = vaults.value.filter((v) => v.position && v.position.shares > 0n);

      if (vaultsToRedeem.length === 0) {
        txStatus.value = "No positions to withdraw";
        return;
      }

      // Add max-approval for each vault (skipped if already approved)
      txStatus.value = "Checking approvals...";
      for (const vault of vaultsToRedeem) {
        const approveTx = await ensureAllowance(
          vault.address,
          userAddress,
          YO_GATEWAY_ADDRESS,
          vault.position!.shares,
        );
        if (approveTx) batch.push(approveTx);
      }

      // 2. Add redeem txs (no approval wrapper needed)
      for (const vault of vaultsToRedeem) {
        txStatus.value = `Preparing ${vault.label} redeem...`;

        const redeemTx = await yo.prepareRedeem({
          vault: vault.address,
          shares: vault.position!.shares,
          recipient: userAddress,
        });
        batch.push({ to: redeemTx.to as `0x${string}`, data: redeemTx.data as `0x${string}`, value: redeemTx.value });
      }

      // Send all in one batch — single user confirmation
      txStatus.value = `Confirm ${batch.length} transactions in your wallet...`;
      await sendBatchTx(batch);

      txStatus.value = "All withdrawals complete!";
      await fetchVaultData(userAddress);
      setTimeout(() => { if (txStatus.value === "All withdrawals complete!") txStatus.value = null; }, 4000);
    } catch (e: any) {
      console.error("Withdraw failed:", e);
      txStatus.value = `Error: ${e.shortMessage || e.message}`;
    }
  };

  const formatAssets = (position: UserVaultPosition | null, decimals: number) => {
    if (!position) return "0";
    return Number(formatUnits(position.assets, decimals)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  // ── Share price history (for sparklines) ──
  const sharePriceHistory = ref<Record<string, SharePriceHistoryPoint[]>>({});

  const fetchSharePriceHistory = async () => {
    for (const def of VAULT_DEFS) {
      try {
        const history = await yo.getSharePriceHistory(def.address);
        sharePriceHistory.value[def.vaultId] = history;
      } catch (e) {
        console.error(`Share price history error ${def.label}:`, e);
      }
    }
  };

  // ── Merkl rewards ──
  const merklRewards = ref<MerklChainRewards | null>(null);

  const fetchMerklRewards = async (userAddress: `0x${string}`) => {
    try {
      merklRewards.value = await yo.getMerklRewards(userAddress);
    } catch (e) {
      console.error("Merkl rewards error:", e);
      merklRewards.value = null;
    }
  };

  const claimMerklRewards = async (
    userAddress: `0x${string}`,
    sendBatchTx: (txs: TxData[]) => Promise<`0x${string}` | undefined>,
  ) => {
    if (!merklRewards.value) return;
    txStatus.value = "Preparing rewards claim...";
    try {
      const tx = yo.prepareClaimMerklRewards(userAddress, merklRewards.value) as PreparedTransaction;
      txStatus.value = "Confirm claim in your wallet...";
      await sendBatchTx([{ to: tx.to as `0x${string}`, data: tx.data as `0x${string}`, value: tx.value }]);
      txStatus.value = "Rewards claimed!";
      await fetchMerklRewards(userAddress);
      setTimeout(() => { if (txStatus.value === "Rewards claimed!") txStatus.value = null; }, 4000);
    } catch (e: any) {
      console.error("Claim rewards failed:", e);
      txStatus.value = `Error: ${e.shortMessage || e.message}`;
    }
  };

  // ── Transaction history ──
  const userHistory = ref<(UserHistoryItem & { vaultLabel: string; vaultId: string })[]>([]);

  const fetchUserHistory = async (userAddress: `0x${string}`) => {
    const items: (UserHistoryItem & { vaultLabel: string; vaultId: string })[] = [];
    for (const def of VAULT_DEFS) {
      try {
        const history = await yo.getUserHistory(def.address, userAddress, 10);
        for (const item of history) {
          items.push({ ...item, vaultLabel: def.label, vaultId: def.vaultId });
        }
      } catch (e) {
        console.error(`History error ${def.label}:`, e);
      }
    }
    items.sort((a, b) => b.blockTimestamp - a.blockTimestamp);
    userHistory.value = items.slice(0, 20);
  };

  // ── Partial withdraw ──
  const withdrawPartial = async (
    userAddress: `0x${string}`,
    selections: { vaultId: string; percentage: number }[],
    sendBatchTx: (txs: TxData[]) => Promise<`0x${string}` | undefined>,
  ) => {
    txStatus.value = "Preparing withdrawals...";

    try {
      const batch: TxData[] = [];
      const vaultsToRedeem = selections
        .filter((s) => s.percentage > 0)
        .map((s) => {
          const vault = vaults.value.find((v) => v.vaultId === s.vaultId);
          if (!vault?.position || vault.position.shares <= 0n) return null;
          const shares = (vault.position.shares * BigInt(Math.round(s.percentage * 100))) / 10000n;
          return { vault, shares };
        })
        .filter(Boolean) as { vault: VaultInfo; shares: bigint }[];

      if (vaultsToRedeem.length === 0) {
        txStatus.value = "No positions to withdraw";
        return;
      }

      txStatus.value = "Checking approvals...";
      for (const { vault, shares } of vaultsToRedeem) {
        const approveTx = await ensureAllowance(vault.address, userAddress, YO_GATEWAY_ADDRESS, shares);
        if (approveTx) batch.push(approveTx);
      }

      for (const { vault, shares } of vaultsToRedeem) {
        txStatus.value = `Preparing ${vault.label} redeem...`;
        const redeemTx = await yo.prepareRedeem({
          vault: vault.address,
          shares,
          recipient: userAddress,
        });
        batch.push({ to: redeemTx.to as `0x${string}`, data: redeemTx.data as `0x${string}`, value: redeemTx.value });
      }

      txStatus.value = `Confirm ${batch.length} transactions in your wallet...`;
      await sendBatchTx(batch);

      txStatus.value = "Withdrawal complete!";
      await fetchVaultData(userAddress);
      setTimeout(() => { if (txStatus.value === "Withdrawal complete!") txStatus.value = null; }, 4000);
    } catch (e: any) {
      console.error("Withdraw failed:", e);
      txStatus.value = `Error: ${e.shortMessage || e.message}`;
    }
  };

  return {
    vaults,
    prices,
    loading,
    txStatus,
    hasPositions,
    fetchVaultData,
    computeWeightedApy,
    prepareDeposits,
    withdrawAll,
    withdrawPartial,
    formatAssets,
    sharePriceHistory,
    fetchSharePriceHistory,
    merklRewards,
    fetchMerklRewards,
    claimMerklRewards,
    userHistory,
    fetchUserHistory,
  };
}
