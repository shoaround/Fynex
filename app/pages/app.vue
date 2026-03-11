<script setup lang="ts">
import { type VaultAllocation, VAULT_DEFS } from "~/config/fund";
import { formatUnits } from "viem";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

const {
  ready,
  address,
  isConnected,
  isConnecting,
  isAuthenticated,
  connectWithWallet,
  sendEmailCode,
  verifyEmailCode,
  loginWithOAuth,
  disconnectWallet,
  sendBatchTx,
} = useWallet();

const {
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
} = useYoProtocol();

const showLoginModal = ref(false);
const loginModalRef = ref<{
  setOtpSent: (v: boolean) => void;
  setError: (m: string) => void;
  setLoading: (v: boolean) => void;
  close: () => void;
} | null>(null);

const showInvestModal = ref(false);
const isDepositing = ref(false);
const isWithdrawing = ref(false);
const showWithdrawModal = ref(false);
const isClaiming = ref(false);
const showHistory = ref(false);

// Fetch vault data on mount and when address changes
const fetchAll = async (addr?: `0x${string}`) => {
  await fetchVaultData(addr);
  fetchSharePriceHistory();
  if (addr) {
    fetchMerklRewards(addr);
    fetchUserHistory(addr);
  }
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchAll(address.value);
  // Auto-refresh every 60s
  pollTimer = setInterval(() => {
    if (!isDepositing.value && !isWithdrawing.value && !isClaiming.value) {
      fetchVaultData(address.value);
    }
  }, 60_000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

watch(address, (addr) => fetchAll(addr));

const vaultColors: Record<string, string> = {
  yoUSD: "#22d3ee",
  yoETH: "#818cf8",
  yoBTC: "#f59e0b",
};

const parseTvlRaw = (tvl: any): number => {
  if (!tvl) return 0;
  const val = typeof tvl === 'object' ? (tvl.formatted ?? tvl.raw) : tvl;
  return parseFloat(String(val).replace(/[$,]/g, '')) || 0;
};

const getTokenPrice = (symbol: string): number => {
  const p = prices.value;
  // Try symbol key, lowercase, or fallback
  return p[symbol] ?? p[symbol.toLowerCase()] ?? p[symbol.toUpperCase()]
    ?? ({ USDC: 1, WETH: 2400, cbBTC: 100000 }[symbol] ?? 1);
};

const totalTvlUsd = computed(() =>
  vaults.value.reduce((sum, v) => {
    const amount = parseTvlRaw(v.snapshot?.stats?.tvl);
    return sum + amount * getTokenPrice(v.underlyingSymbol);
  }, 0)
);

const formatUsd = (value: number) => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value > 0 && value < 0.01) return '< $0.01';
  return `$${value.toFixed(2)}`;
};

const formatTokenAmount = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
};

const getVaultTvlFormatted = (vault: any): string => {
  const amount = parseTvlRaw(vault.snapshot?.stats?.tvl);
  return `${formatTokenAmount(amount)} ${vault.underlyingSymbol}`;
};

const getVaultTvlUsd = (vault: any): string => {
  const amount = parseTvlRaw(vault.snapshot?.stats?.tvl);
  return formatUsd(amount * getTokenPrice(vault.underlyingSymbol));
};

// ── Stash computed ──
const stashVaults = computed(() =>
  vaults.value.filter((v) => v.position && v.position.shares > 0n)
);

const stashTotalUsd = computed(() =>
  stashVaults.value.reduce((sum, v) => {
    if (!v.position) return sum;
    const amount = Number(formatUnits(v.position.assets, v.underlyingDecimals));
    return sum + amount * getTokenPrice(v.underlyingSymbol);
  }, 0)
);

const stashAllocations = computed(() => {
  if (stashTotalUsd.value <= 0) return [];
  return stashVaults.value.map((v) => {
    const amount = Number(formatUnits(v.position!.assets, v.underlyingDecimals));
    const valueUsd = amount * getTokenPrice(v.underlyingSymbol);
    const unrealizedFormatted = v.performance?.unrealized?.formatted;
    const pnlToken = unrealizedFormatted != null ? parseFloat(String(unrealizedFormatted).replace(/[^0-9.\-]/g, '')) : 0;
    const pnlUsd = pnlToken * getTokenPrice(v.underlyingSymbol);
    return {
      vaultId: v.vaultId,
      label: v.label,
      underlyingSymbol: v.underlyingSymbol,
      amount,
      valueUsd,
      percentage: (valueUsd / stashTotalUsd.value) * 100,
      pnlToken,
      pnlUsd,
    };
  }).sort((a, b) => b.percentage - a.percentage);
});

const totalPnlUsd = computed(() =>
  stashAllocations.value.reduce((sum, a) => sum + a.pnlUsd, 0)
);

// ── Sparkline SVG path builder ──
const buildSparklinePath = (vaultId: string): string => {
  const points = sharePriceHistory.value[vaultId];
  if (!points || points.length < 2) return "";
  const values = points.map((p) => parseFloat(p.pricePerShare));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};

const sparklineColor = (vaultId: string): string => {
  const points = sharePriceHistory.value[vaultId];
  if (!points || points.length < 2) return vaultColors[vaultId] || "#818cf8";
  const first = parseFloat(points[0]!.pricePerShare);
  const last = parseFloat(points[points.length - 1]!.pricePerShare);
  return last >= first ? "#4ade80" : "#f87171";
};

// ── Merkl rewards helpers ──
const claimableRewards = computed(() => {
  if (!merklRewards.value?.rewards) return [];
  return merklRewards.value.rewards.filter((r) => {
    const amount = BigInt(r.amount);
    const claimed = BigInt(r.claimed);
    return amount > claimed;
  });
});

const totalRewardsUsd = computed(() =>
  claimableRewards.value.reduce((sum, r) => {
    const claimable = Number(r.amount) - Number(r.claimed);
    const price = r.token.price ?? 0;
    return sum + (claimable / 10 ** r.token.decimals) * price;
  }, 0)
);

// ── History formatting ──
const formatHistoryDate = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const handleLogin = async (method: string, payload?: any) => {
  try {
    if (method === "email:send-code") {
      await sendEmailCode(payload);
      loginModalRef.value?.setOtpSent(true);
    } else if (method === "email:verify") {
      await verifyEmailCode(payload.email, payload.code);
      loginModalRef.value?.close();
    } else if (method === "oauth") {
      await loginWithOAuth(payload);
    } else if (method === "wallet") {
      await connectWithWallet(payload);
      loginModalRef.value?.close();
    }
  } catch (err: any) {
    loginModalRef.value?.setError(err.shortMessage || err.message || "Something went wrong");
  }
};

const handleInvest = async (payload: {
  allocations: VaultAllocation[];
  fundName: string;
  token: any;
  amount: string;
}) => {
  if (!address.value) return;
  isDepositing.value = true;
  try {
    await prepareDeposits(payload.amount, payload.allocations, address.value, sendBatchTx, {
      address: payload.token.token,
      decimals: payload.token.decimals,
      symbol: payload.token.symbol,
    });
    await fetchAll(address.value);
  } finally {
    isDepositing.value = false;
  }
};

const handleWithdrawAll = async () => {
  if (!address.value) return;
  isWithdrawing.value = true;
  try {
    await withdrawAll(address.value, sendBatchTx);
    await fetchAll(address.value);
  } finally {
    isWithdrawing.value = false;
  }
};

const handleWithdrawPartial = async (selections: { vaultId: string; percentage: number }[]) => {
  if (!address.value) return;
  isWithdrawing.value = true;
  try {
    await withdrawPartial(address.value, selections, sendBatchTx);
    await fetchAll(address.value);
  } finally {
    isWithdrawing.value = false;
  }
};

const handleClaimRewards = async () => {
  if (!address.value) return;
  isClaiming.value = true;
  try {
    await claimMerklRewards(address.value, sendBatchTx);
    await fetchAll(address.value);
  } finally {
    isClaiming.value = false;
  }
};
</script>

<template>
  <!-- Loading Screen -->
  <div v-if="!ready" class="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
    <img src="/logo.png" alt="Fynex" class="w-16 h-16 rounded-full animate-pulse" />
    <p class="text-muted-foreground text-sm">Loading...</p>
  </div>

  <div v-else class="min-h-screen bg-background relative overflow-hidden">
    <!-- Background effects -->
    <div class="pointer-events-none absolute inset-0">
      <!-- Gradient orbs -->
      <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/8 blur-[120px]" />
      <div class="absolute top-1/3 -right-48 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[150px]" />
      <div class="absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-accent/5 blur-[100px]" />
      <!-- Grid pattern -->
      <div
        class="absolute inset-0 opacity-[0.03]"
        style="background-image: linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px); background-size: 60px 60px;"
      />
    </div>

    <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      <!-- Navbar -->
      <nav class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="/logo.png" alt="Fynex" class="w-9 h-9 rounded-lg" />
          <span class="text-lg font-bold tracking-tight">Fynex</span>
        </div>
        <div v-if="isConnected || isAuthenticated" class="flex items-center gap-2">
          <Badge v-if="address" variant="secondary" class="font-mono text-xs">
            {{ address.slice(0, 6) }}...{{ address.slice(-4) }}
          </Badge>
          <Button variant="ghost" size="sm" @click="disconnectWallet" class="text-muted-foreground text-xs">
            Disconnect
          </Button>
        </div>
        <Button v-else @click="showLoginModal = true" :disabled="isConnecting" size="sm">
          {{ isConnecting ? "Connecting..." : "Sign In" }}
        </Button>
      </nav>

      <!-- Login Modal -->
      <LoginModal
        ref="loginModalRef"
        v-model:open="showLoginModal"
        @login="handleLogin"
      />

      <!-- Hero section -->
      <div class="text-center lg:text-left space-y-3 py-4">
        <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">
          Earn yield, <span class="text-primary">effortlessly</span>
        </h1>
        <p class="text-muted-foreground max-w-md lg:max-w-none">
          Diversified DeFi portfolios on Base. Pick a strategy, deposit, and let your assets grow.
        </p>
        <div v-if="!(isConnected || isAuthenticated)" class="pt-2">
          <Button @click="showLoginModal = true" size="lg" class="px-8">
            Get Started
            <Icon name="lucide:arrow-right" class="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <!-- ═══ Main content: 2-column on desktop ═══ -->
      <div class="lg:grid lg:grid-cols-5 lg:gap-6 space-y-8 lg:space-y-0">

        <!-- LEFT COLUMN: Stash + Rewards (sticky on desktop) -->
        <div class="lg:col-span-2 space-y-6 lg:order-1 order-2">
          <template v-if="isConnected || isAuthenticated">
            <!-- Invest CTA (only when no stash yet and done loading) -->
            <div v-if="!hasPositions && !loading" class="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 overflow-hidden">
              <div class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
              <div class="relative space-y-3">
                <div class="space-y-1.5">
                  <h2 class="text-xl font-bold">Create Your Stash</h2>
                  <p class="text-sm text-muted-foreground">
                    Pick a strategy, choose a token, and start earning yield
                  </p>
                </div>
                <Button
                  size="lg"
                  @click="showInvestModal = true"
                  :disabled="isDepositing"
                  class="w-full"
                >
                  <Icon name="lucide:plus" class="w-4 h-4 mr-2" />
                  {{ isDepositing ? "Processing..." : "Create Stash" }}
                </Button>
              </div>
            </div>

            <!-- Invest Modal -->
            <InvestModal
              v-if="address"
              v-model:open="showInvestModal"
              :address="address"
              :vaults="vaults"
              :loading="loading"
              :tx-status="txStatus"
              :is-depositing="isDepositing"
              :compute-weighted-apy="computeWeightedApy"
              @invest="handleInvest"
            />

            <!-- Your Stash -->
            <div v-if="isConnected && (hasPositions || loading)" class="space-y-3">
              <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Stash</h2>

              <!-- Skeleton stash -->
              <div v-if="loading && !hasPositions" class="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden animate-pulse">
                <div class="px-5 pt-5 pb-4 space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="space-y-2">
                      <div class="h-3 w-16 rounded bg-secondary" />
                      <div class="h-8 w-28 rounded bg-secondary" />
                    </div>
                    <div class="flex gap-2">
                      <div class="h-8 w-16 rounded-md bg-secondary" />
                      <div class="h-8 w-20 rounded-md bg-secondary" />
                    </div>
                  </div>
                  <div class="h-2 rounded-full bg-secondary" />
                </div>
                <div class="border-t border-border divide-y divide-border">
                  <div v-for="i in 3" :key="i" class="flex items-center justify-between px-5 py-3">
                    <div class="flex items-center gap-2.5">
                      <div class="w-2.5 h-2.5 rounded-full bg-secondary" />
                      <div class="h-4 w-20 rounded bg-secondary" />
                    </div>
                    <div class="space-y-1 flex flex-col items-end">
                      <div class="h-4 w-14 rounded bg-secondary" />
                      <div class="h-3 w-20 rounded bg-secondary" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Loaded stash -->
              <div v-else-if="hasPositions" class="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
                <!-- Stash header with total value -->
                <div class="px-5 pt-5 pb-4 space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-xs text-muted-foreground mb-1">Total Value</p>
                      <p class="text-3xl font-bold tracking-tight">{{ formatUsd(stashTotalUsd) }}</p>
                      <p
                        v-if="totalPnlUsd !== 0"
                        class="text-sm font-semibold mt-0.5"
                        :class="totalPnlUsd >= 0 ? 'text-green-400' : 'text-red-400'"
                      >
                        {{ totalPnlUsd >= 0 ? '+' : '-' }}{{ formatUsd(Math.abs(totalPnlUsd)) }}
                        <span class="text-xs font-normal text-muted-foreground ml-1">PNL</span>
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        @click="showInvestModal = true"
                        :disabled="isDepositing"
                        class="text-xs"
                      >
                        <Icon name="lucide:plus" class="w-3.5 h-3.5 mr-1" />
                        Add
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        @click="showWithdrawModal = true"
                        :disabled="isWithdrawing"
                        class="text-xs"
                      >
                        <Icon name="lucide:arrow-up-right" class="w-3.5 h-3.5 mr-1" />
                        {{ isWithdrawing ? "..." : "Withdraw" }}
                      </Button>
                    </div>
                  </div>

                  <!-- Allocation bar -->
                  <div class="flex h-2 rounded-full overflow-hidden bg-secondary">
                    <div
                      v-for="alloc in stashAllocations"
                      :key="alloc.vaultId"
                      class="h-full transition-all duration-500"
                      :style="{ width: alloc.percentage + '%', backgroundColor: vaultColors[alloc.vaultId] }"
                    />
                  </div>
                </div>

                <!-- Vault breakdown -->
                <div class="border-t border-border divide-y divide-border">
                  <div
                    v-for="alloc in stashAllocations"
                    :key="alloc.vaultId"
                    class="flex items-center justify-between px-5 py-3"
                  >
                    <div class="flex items-center gap-2.5">
                      <span
                        class="w-2.5 h-2.5 rounded-full shrink-0"
                        :style="{ backgroundColor: vaultColors[alloc.vaultId] }"
                      />
                      <div>
                        <span class="text-sm font-semibold">{{ alloc.label }}</span>
                        <span class="text-xs text-muted-foreground ml-1.5">{{ alloc.percentage.toFixed(0) }}%</span>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-sm font-semibold">{{ formatUsd(alloc.valueUsd) }}</p>
                      <p
                        v-if="alloc.pnlUsd !== 0"
                        class="text-[11px] font-semibold"
                        :class="alloc.pnlUsd >= 0 ? 'text-green-400' : 'text-red-400'"
                      >
                        {{ alloc.pnlUsd >= 0 ? '+' : '-' }}{{ formatUsd(Math.abs(alloc.pnlUsd)) }}
                      </p>
                      <p class="text-[11px] text-muted-foreground font-mono">
                        {{ formatTokenAmount(alloc.amount) }} {{ alloc.underlyingSymbol }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Withdraw Modal -->
            <WithdrawModal
              v-model:open="showWithdrawModal"
              :stash-allocations="stashAllocations"
              :stash-total-usd="stashTotalUsd"
              :vault-colors="vaultColors"
              :tx-status="txStatus"
              :is-withdrawing="isWithdrawing"
              @withdraw-all="handleWithdrawAll"
              @withdraw-partial="handleWithdrawPartial"
            />

            <!-- Rewards Section -->
            <div v-if="claimableRewards.length > 0" class="space-y-3">
              <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Rewards</h2>
              <div class="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
                <div class="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p class="text-xs text-muted-foreground mb-0.5">Claimable Rewards</p>
                    <p class="text-xl font-bold">{{ formatUsd(totalRewardsUsd) }}</p>
                  </div>
                  <Button
                    size="sm"
                    @click="handleClaimRewards"
                    :disabled="isClaiming"
                    class="text-xs"
                  >
                    <Icon name="lucide:gift" class="w-3.5 h-3.5 mr-1" />
                    {{ isClaiming ? "Claiming..." : "Claim All" }}
                  </Button>
                </div>
                <div class="border-t border-border divide-y divide-border">
                  <div
                    v-for="reward in claimableRewards"
                    :key="reward.token.address"
                    class="flex items-center justify-between px-5 py-2.5"
                  >
                    <div class="flex items-center gap-2">
                      <img
                        v-if="reward.token.icon"
                        :src="reward.token.icon"
                        :alt="reward.token.symbol"
                        class="w-5 h-5 rounded-full"
                        @error="($event.target as HTMLImageElement).style.display = 'none'"
                      />
                      <span class="text-sm font-medium">{{ reward.token.symbol }}</span>
                    </div>
                    <span class="text-sm font-mono">
                      {{ ((Number(reward.amount) - Number(reward.claimed)) / 10 ** reward.token.decimals).toFixed(4) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Transaction Status (claim only, deposit/withdraw show in modals) -->
            <div v-if="txStatus && !isDepositing && !isWithdrawing && !showInvestModal && !showWithdrawModal" class="rounded-xl border border-border bg-card/80 backdrop-blur-sm px-4 py-3">
              <p class="text-sm text-muted-foreground">{{ txStatus }}</p>
            </div>
          </template>

          <!-- Not signed in prompt (left column) -->
          <template v-else>
            <div class="text-center lg:text-left py-4">
              <p class="text-sm text-muted-foreground">
                <button @click="showLoginModal = true" class="text-primary hover:underline font-medium">Sign in</button>
                to create your stash and start earning yield
              </p>
            </div>
          </template>
        </div>

        <!-- RIGHT COLUMN: Vaults + History -->
        <div class="lg:col-span-3 space-y-6 lg:order-2 order-1">
          <!-- Vault cards -->
          <div class="space-y-3">
            <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Vaults</h2>

            <!-- Skeleton vault cards -->
            <div v-if="loading && vaults.length === 0" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                v-for="i in 3"
                :key="i"
                class="relative rounded-xl border border-border bg-card/80 backdrop-blur-sm px-4 py-4 space-y-3 overflow-hidden animate-pulse"
              >
                <div class="absolute top-0 left-0 right-0 h-0.5 bg-secondary" />
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-secondary" />
                    <div class="h-4 w-12 rounded bg-secondary" />
                  </div>
                  <div class="h-4 w-10 rounded bg-secondary" />
                </div>
                <div class="space-y-1.5">
                  <div class="h-3 w-8 rounded bg-secondary" />
                  <div class="h-6 w-16 rounded bg-secondary" />
                  <div class="h-3 w-20 rounded bg-secondary" />
                </div>
                <div class="space-y-1.5">
                  <div class="h-3 w-14 rounded bg-secondary" />
                  <div class="h-4 w-10 rounded bg-secondary" />
                </div>
              </div>
            </div>

            <!-- Loaded vault cards -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                v-for="vault in vaults"
                :key="vault.vaultId"
                class="group relative rounded-xl border border-border bg-card/80 backdrop-blur-sm px-4 py-4 space-y-3 transition-all hover:border-border/80 hover:shadow-lg hover:shadow-black/5 overflow-hidden"
              >
                <!-- Vault color accent bar -->
                <div
                  class="absolute top-0 left-0 right-0 h-0.5"
                  :style="{ backgroundColor: vaultColors[vault.vaultId] }"
                />
                <!-- Subtle glow on hover -->
                <div
                  class="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 blur-2xl transition-opacity"
                  :style="{ backgroundColor: vaultColors[vault.vaultId] + '15' }"
                />

                <div class="relative flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2 h-2 rounded-full"
                      :style="{ backgroundColor: vaultColors[vault.vaultId] }"
                    />
                    <span class="text-sm font-bold">{{ vault.label }}</span>
                  </div>
                  <Badge variant="outline" class="text-[10px] px-1.5 py-0 text-muted-foreground border-border">
                    {{ vault.underlyingSymbol }}
                  </Badge>
                </div>
                <div class="relative">
                  <p class="text-[11px] text-muted-foreground">TVL</p>
                  <p class="text-lg font-bold">{{ getVaultTvlUsd(vault) }}</p>
                  <p class="text-[11px] text-muted-foreground">
                    {{ getVaultTvlFormatted(vault) }}
                  </p>
                </div>
                <div v-if="Number(vault.snapshot?.stats?.yield?.['30d'] ?? 0) > 0" class="relative">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-[11px] text-muted-foreground">30d Return</p>
                      <p class="text-sm font-semibold" :style="{ color: vaultColors[vault.vaultId] }">
                        {{ Number(vault.snapshot?.stats?.yield?.['30d'] ?? 0).toFixed(2) }}%
                      </p>
                    </div>
                    <!-- Sparkline -->
                    <svg
                      v-if="buildSparklinePath(vault.vaultId)"
                      class="w-[80px] h-[24px] opacity-60"
                      viewBox="0 0 80 24"
                      fill="none"
                      preserveAspectRatio="none"
                    >
                      <path
                        :d="buildSparklinePath(vault.vaultId)"
                        :stroke="sparklineColor(vault.vaultId)"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Transaction History -->
          <div v-if="(isConnected || isAuthenticated) && userHistory.length > 0" class="space-y-3">
            <button
              @click="showHistory = !showHistory"
              class="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              History
              <Icon
                :name="showHistory ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                class="w-3.5 h-3.5"
              />
            </button>
            <div v-if="showHistory" class="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
              <div class="divide-y divide-border">
                <a
                  v-for="(tx, i) in userHistory"
                  :key="tx.transactionHash + i"
                  :href="`https://basescan.org/tx/${tx.transactionHash}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center justify-between px-5 py-3 hover:bg-secondary/30 transition-colors cursor-pointer group"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="w-7 h-7 rounded-full flex items-center justify-center"
                      :class="tx.type.toLowerCase() === 'deposit' ? 'bg-green-500/10' : 'bg-red-500/10'"
                    >
                      <Icon
                        :name="tx.type.toLowerCase() === 'deposit' ? 'lucide:arrow-down-left' : 'lucide:arrow-up-right'"
                        class="w-3.5 h-3.5"
                        :class="tx.type.toLowerCase() === 'deposit' ? 'text-green-400' : 'text-red-400'"
                      />
                    </div>
                    <div>
                      <p class="text-sm font-medium capitalize">{{ tx.type }}</p>
                      <p class="text-[11px] text-muted-foreground">
                        {{ tx.vaultLabel }} · {{ formatHistoryDate(tx.blockTimestamp) }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="text-right">
                      <p class="text-sm font-mono font-medium">{{ tx.assets.formatted }}</p>
                      <p class="text-[10px] text-muted-foreground font-mono">
                        {{ tx.transactionHash.slice(0, 6) }}...{{ tx.transactionHash.slice(-4) }}
                      </p>
                    </div>
                    <Icon name="lucide:external-link" class="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
