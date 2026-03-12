<script setup lang="ts">
import {
  Dialog,
  DialogContent,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  FUND_PRESETS,
  VAULT_DEFS,
  buildAllocations,
  type FundPreset,
  type VaultId,
  type VaultAllocation,
} from "~/config/fund";
import { VERIFIED_TOKENS } from "~/config/verified-tokens";
import type { VaultInfo } from "~/composables/useYoProtocol";

type TokenBalance = {
  token: string;
  symbol: string;
  name: string;
  amount: string;
  decimals: number;
  price: string;
  logoUri: string;
  balance: number;
  valueUsd: number;
};

const props = defineProps<{
  open: boolean;
  address: `0x${string}`;
  vaults: VaultInfo[];
  loading: boolean;
  txStatus: string | null;
  isDepositing: boolean;
  computeWeightedApy: (allocations: VaultAllocation[]) => number;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  invest: [payload: {
    allocations: VaultAllocation[];
    fundName: string;
    token: TokenBalance;
    amount: string;
  }];
}>();

// ── Step state ──
type Step = 1 | 2 | 3 | 4;
const step = ref<Step>(1);

// Watch txStatus to detect completion or error
const txError = ref<string | null>(null);
const txSuccess = ref(false);

watch(() => props.txStatus, (status) => {
  if (!status) return;
  if (status.startsWith("Error:")) {
    txError.value = status.replace("Error: ", "");
  } else if (status === "Stash created!") {
    txSuccess.value = true;
  }
});

watch(() => props.isDepositing, (depositing, prev) => {
  if (prev && !depositing && txSuccess.value) {
    close();
  }
});

// ── Step 1: Portfolio ──
type FundMode = "preset" | "custom";
const fundMode = ref<FundMode>("preset");
const selectedPresetId = ref(FUND_PRESETS[1]!.id);

const customSliders = ref<Record<VaultId, number>>({
  yoUSD: 34, yoETH: 33, yoBTC: 33,
});

const customTotal = computed(() =>
  Object.values(customSliders.value).reduce((a, b) => a + b, 0)
);
const isCustomValid = computed(() => customTotal.value === 100);

const selectedPreset = computed(() =>
  FUND_PRESETS.find((f) => f.id === selectedPresetId.value) ?? FUND_PRESETS[1]!
);

const activeAllocations = computed(() => {
  const allocs = fundMode.value === "custom"
    ? buildAllocations(customSliders.value)
    : buildAllocations(selectedPreset.value.allocations);
  return [...allocs].sort((a, b) => b.percentage - a.percentage);
});

const activeName = computed(() =>
  fundMode.value === "custom" ? "Custom Stash" : selectedPreset.value.name
);

const weightedApy = computed(() =>
  props.computeWeightedApy(activeAllocations.value)
);

const riskIcons: Record<string, string> = {
  low: "lucide:shield",
  medium: "lucide:scale",
  high: "lucide:flame",
};
const riskColors: Record<string, string> = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

const selectPreset = (preset: FundPreset) => {
  fundMode.value = "preset";
  selectedPresetId.value = preset.id;
};

const sliderMax = (vaultId: VaultId) => {
  const current = customSliders.value[vaultId];
  const othersTotal = customTotal.value - current;
  return 100 - othersTotal;
};

const adjustSlider = (vaultId: VaultId, value: number, event: Event) => {
  const max = sliderMax(vaultId);
  const clamped = Math.max(0, Math.min(max, value));
  customSliders.value[vaultId] = clamped;
  const el = event.target as HTMLInputElement;
  if (value > max) {
    el.value = String(clamped);
  }
};

const getVaultApy = (vaultId: VaultId) => {
  const vault = props.vaults.find((v) => v.vaultId === vaultId);
  return Number(vault?.snapshot?.stats?.yield?.["30d"] ?? 0);
};

// ── Step 2: Token selection ──
const { getBalances } = useEnso();
const tokens = ref<TokenBalance[]>([]);
const isLoadingTokens = ref(false);
const tokenError = ref("");
const selectedToken = ref<TokenBalance | null>(null);
const tokenSearch = ref("");

const filteredTokens = computed(() => {
  const q = tokenSearch.value.toLowerCase().trim();
  if (!q) return tokens.value;
  return tokens.value.filter(
    (t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.token.toLowerCase() === q
  );
});

const fetchTokens = async () => {
  if (!props.address) return;
  isLoadingTokens.value = true;
  tokenError.value = "";
  try {
    const raw = await getBalances(props.address);
    tokens.value = raw
      .filter((t) => {
        if (!VERIFIED_TOKENS.has(t.token.toLowerCase())) return false;
        return Number(t.amount) / 10 ** t.decimals > 0;
      })
      .map((t) => {
        const balance = Number(t.amount) / 10 ** t.decimals;
        return { ...t, balance, valueUsd: balance * Number(t.price) };
      })
      .sort((a, b) => b.valueUsd - a.valueUsd);
  } catch (err: any) {
    tokenError.value = err.message || "Failed to load balances";
  } finally {
    isLoadingTokens.value = false;
  }
};

// ── Step 3: Amount ──
const investAmount = ref("");
const usdValue = computed(() => {
  if (!investAmount.value || !selectedToken.value) return 0;
  return Number(investAmount.value) * Number(selectedToken.value.price);
});

const allocationPreview = computed(() => {
  if (usdValue.value <= 0) return [];
  return activeAllocations.value.map((alloc) => ({
    label: alloc.label,
    percentage: alloc.percentage,
    usdAmount: (usdValue.value * alloc.percentage) / 100,
  }));
});

const setMax = () => {
  if (selectedToken.value) {
    investAmount.value = String(selectedToken.value.balance);
  }
};

// ── Navigation ──
const canNext = computed(() => {
  if (step.value === 1) return fundMode.value === "preset" || isCustomValid.value;
  if (step.value === 2) return !!selectedToken.value;
  if (step.value === 3) return !!investAmount.value && Number(investAmount.value) > 0;
  return false;
});

const goNext = () => {
  if (step.value === 1) {
    step.value = 2;
    if (tokens.value.length === 0) fetchTokens();
  } else if (step.value === 2) {
    step.value = 3;
  } else if (step.value === 3) {
    handleInvest();
  }
};

const goBack = () => {
  if (step.value === 2) step.value = 1;
  else if (step.value === 3) step.value = 2;
};

const goToStep = (s: Step) => {
  if (s < step.value) step.value = s;
  else if (s === 2 && canNext.value && step.value === 1) goNext();
};

const handleInvest = () => {
  if (!selectedToken.value || !investAmount.value) return;
  txError.value = null;
  txSuccess.value = false;
  step.value = 4;
  emit("invest", {
    allocations: activeAllocations.value,
    fundName: activeName.value,
    token: selectedToken.value,
    amount: investAmount.value,
  });
};

const close = () => {
  // Don't allow closing during active transaction (but allow if success or error)
  if (step.value === 4 && props.isDepositing && !txError.value && !txSuccess.value) return;
  emit("update:open", false);
  setTimeout(() => {
    step.value = 1;
    investAmount.value = "";
    tokenSearch.value = "";
    txError.value = null;
    txSuccess.value = false;
  }, 200);
};

const formatUsd = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD" });

const formatBal = (v: number) => {
  if (v < 0.0001) return "< 0.0001";
  if (v < 1) return v.toFixed(4);
  return v.toLocaleString("en-US", { maximumFractionDigits: v < 1000 ? 2 : 0 });
};

const vaultColors: Record<string, string> = {
  yoUSD: "#22d3ee",  // cyan
  yoETH: "#818cf8",  // indigo
  yoBTC: "#f59e0b",  // amber
};

const stepLabels = ["Strategy", "Token", "Amount"];
const retryInvest = () => {
  txError.value = null;
  step.value = 3;
};
</script>

<template>
  <Dialog :open="open" @update:open="(v: boolean) => v ? null : close()">
    <DialogContent class="sm:max-w-[540px] p-0 overflow-hidden max-h-[85vh] flex flex-col">

      <!-- Top: Step navigation circles -->
      <div v-if="step < 4" class="shrink-0 flex items-center justify-center gap-8 py-5 px-6 border-b border-border bg-card/50">
        <template v-for="(label, i) in stepLabels" :key="i">
          <button
            @click="goToStep((i + 1) as Step)"
            class="flex flex-col items-center gap-1.5 group"
            :class="i + 1 <= step ? 'cursor-pointer' : 'cursor-default'"
          >
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
              :class="
                i + 1 === step
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                  : i + 1 < step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground'
              "
            >
              <Icon v-if="i + 1 < step" name="lucide:check" class="w-4 h-4" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span
              class="text-[11px] font-medium"
              :class="i + 1 === step ? 'text-foreground' : 'text-muted-foreground'"
            >
              {{ label }}
            </span>
          </button>
          <div
            v-if="i < stepLabels.length - 1"
            class="w-12 h-px -mt-5"
            :class="i + 1 < step ? 'bg-primary/40' : 'bg-border'"
          />
        </template>
      </div>

      <!-- ═══ Step 1: Strategy ═══ -->
      <div v-if="step === 1" class="flex-1 overflow-y-auto p-5 space-y-4">
        <!-- Preset cards as a more visual grid -->
        <div class="grid grid-cols-3 gap-2.5">
          <button
            v-for="preset in FUND_PRESETS"
            :key="preset.id"
            @click="selectPreset(preset)"
            class="relative rounded-xl border p-3.5 text-center transition-all"
            :class="fundMode === 'preset' && selectedPresetId === preset.id
              ? 'border-primary bg-primary/5 shadow-[0_0_12px_-4px] shadow-primary/30'
              : 'border-border hover:border-primary/30 bg-card'"
          >
            <div class="flex justify-center mb-2">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center"
                :class="
                  fundMode === 'preset' && selectedPresetId === preset.id
                    ? 'bg-primary/15'
                    : 'bg-secondary'
                "
              >
                <Icon :name="riskIcons[preset.risk]" class="w-5 h-5" :class="riskColors[preset.risk]" />
              </div>
            </div>
            <p class="text-sm font-bold">{{ preset.name }}</p>
            <p class="text-[10px] text-muted-foreground mt-0.5 capitalize">{{ preset.risk }} risk</p>
            <!-- Mini allocation dots -->
            <div class="flex justify-center gap-0.5 mt-2.5">
              <div
                v-for="alloc in buildAllocations(preset.allocations).sort((a, b) => b.percentage - a.percentage)"
                :key="alloc.vaultId"
                class="h-1 rounded-full transition-all"
                :style="{ width: alloc.percentage * 0.4 + 'px', backgroundColor: vaultColors[alloc.vaultId] }"
              />
            </div>
            <!-- Check -->
            <div
              v-if="fundMode === 'preset' && selectedPresetId === preset.id"
              class="absolute top-2 right-2"
            >
              <Icon name="lucide:check-circle-2" class="w-4 h-4 text-primary" />
            </div>
          </button>
        </div>

        <!-- Selected preset detail -->
        <div v-if="fundMode === 'preset'" class="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-2">
          <p class="text-xs text-muted-foreground">{{ selectedPreset.description }}</p>
          <div class="flex h-2 rounded-full overflow-hidden bg-secondary">
            <div
              v-for="alloc in activeAllocations"
              :key="alloc.vaultId"
              class="h-full transition-all"
              :style="{ width: alloc.percentage + '%', backgroundColor: vaultColors[alloc.vaultId] }"
            />
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-0.5">
            <span
              v-for="alloc in activeAllocations"
              :key="alloc.vaultId"
              class="text-[11px] text-muted-foreground flex items-center gap-1"
            >
              <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: vaultColors[alloc.vaultId] }" />
              {{ alloc.label }} {{ alloc.percentage }}%
            </span>
          </div>
        </div>

        <!-- Custom toggle -->
        <button
          @click="fundMode = fundMode === 'custom' ? 'preset' : 'custom'"
          class="w-full flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
          :class="fundMode === 'custom'
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/30'"
        >
          <div class="flex items-center gap-2.5">
            <Icon name="lucide:sliders-horizontal" class="w-4 h-4 text-muted-foreground" />
            <span class="text-sm font-medium">Custom mix</span>
          </div>
          <Icon
            :name="fundMode === 'custom' ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            class="w-4 h-4 text-muted-foreground"
          />
        </button>

        <!-- Custom sliders (expandable) -->
        <div v-if="fundMode === 'custom'" class="space-y-3 rounded-lg border border-border p-4">
          <div v-for="def in VAULT_DEFS" :key="def.vaultId" class="space-y-1">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold">{{ def.label }}</span>
                <span class="text-[10px] text-muted-foreground">{{ def.underlyingSymbol }}</span>
              </div>
              <span class="text-sm font-mono font-bold tabular-nums w-10 text-right">{{ customSliders[def.vaultId] }}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="1"
              :value="customSliders[def.vaultId]"
              @input="adjustSlider(def.vaultId, Number(($event.target as HTMLInputElement).value), $event)"
              class="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary bg-secondary"
            />
          </div>
          <div class="flex justify-between items-center pt-2 border-t border-border">
            <span class="text-sm font-medium">Total</span>
            <span
              class="text-sm font-mono font-bold"
              :class="isCustomValid ? 'text-primary' : 'text-destructive'"
            >
              {{ customTotal }}%
            </span>
          </div>
          <p v-if="!isCustomValid" class="text-xs text-destructive">Must equal 100%</p>
        </div>

        <!-- APY hint -->
        <div v-if="weightedApy > 0 && (fundMode === 'preset' || isCustomValid)" class="text-center">
          <span class="text-xs text-muted-foreground">
            Est. return: <span class="text-primary font-semibold">{{ weightedApy.toFixed(2) }}%</span> / year
          </span>
        </div>
      </div>

      <!-- ═══ Step 2: Token ═══ -->
      <div v-else-if="step === 2" class="flex-1 overflow-y-auto p-5 space-y-4">
        <!-- Search bar -->
        <div class="relative">
          <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            v-model="tokenSearch"
            placeholder="Search token or paste address"
            class="pl-9"
          />
        </div>

        <!-- Loading skeleton -->
        <div v-if="isLoadingTokens" class="grid grid-cols-2 gap-2">
          <div v-for="i in 4" :key="i" class="rounded-xl border border-border p-3 animate-pulse">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-7 h-7 rounded-full bg-secondary" />
              <div class="h-3 bg-secondary rounded w-12" />
            </div>
            <div class="h-4 bg-secondary rounded w-16 mb-1" />
            <div class="h-2.5 bg-secondary rounded w-10" />
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="tokenError" class="text-center py-6">
          <p class="text-sm text-destructive mb-2">{{ tokenError }}</p>
          <Button variant="outline" size="sm" @click="fetchTokens">Retry</Button>
        </div>

        <!-- Empty -->
        <div v-else-if="filteredTokens.length === 0 && !isLoadingTokens" class="text-center py-8">
          <Icon name="lucide:coins" class="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p class="text-sm text-muted-foreground">
            {{ tokenSearch ? "No matching tokens" : "No tokens in wallet" }}
          </p>
        </div>

        <!-- Token grid -->
        <div v-else class="grid grid-cols-2 gap-2">
          <button
            v-for="token in filteredTokens"
            :key="token.token"
            @click="selectedToken = token"
            class="rounded-xl border p-3 text-left transition-all"
            :class="selectedToken?.token === token.token
              ? 'border-primary bg-primary/5 shadow-[0_0_12px_-4px] shadow-primary/30'
              : 'border-border hover:border-primary/30 bg-card'"
          >
            <div class="flex items-center gap-2 mb-1.5">
              <div class="w-7 h-7 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                <img
                  v-if="token.logoUri"
                  :src="token.logoUri"
                  :alt="token.symbol"
                  class="w-7 h-7 rounded-full"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
                <span v-else class="text-[10px] font-bold">{{ token.symbol.slice(0, 2) }}</span>
              </div>
              <span class="text-sm font-bold truncate">{{ token.symbol }}</span>
              <Icon
                v-if="selectedToken?.token === token.token"
                name="lucide:check"
                class="w-3.5 h-3.5 text-primary ml-auto shrink-0"
              />
            </div>
            <p class="text-base font-bold">{{ formatUsd(token.valueUsd) }}</p>
            <p class="text-[11px] text-muted-foreground">{{ formatBal(token.balance) }} {{ token.symbol }}</p>
          </button>
        </div>
      </div>

      <!-- ═══ Step 3: Amount & Review ═══ -->
      <div v-else-if="step === 3" class="flex-1 overflow-y-auto p-5 space-y-5">
        <!-- Big centered amount input -->
        <div class="text-center space-y-3">
          <div v-if="selectedToken" class="inline-flex items-center gap-2 rounded-full bg-secondary/50 px-3 py-1.5">
            <div class="w-5 h-5 rounded-full bg-secondary overflow-hidden">
              <img v-if="selectedToken.logoUri" :src="selectedToken.logoUri" :alt="selectedToken.symbol" class="w-5 h-5 rounded-full" />
            </div>
            <span class="text-sm font-medium">{{ selectedToken.symbol }}</span>
            <button @click="step = 2" class="text-[10px] text-primary hover:underline ml-1">change</button>
          </div>

          <div class="relative max-w-xs mx-auto">
            <input
              v-model="investAmount"
              type="number"
              :placeholder="'0.00'"
              class="w-full bg-transparent text-center text-4xl font-bold outline-none placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div class="flex items-center justify-center gap-3">
            <p v-if="usdValue > 0" class="text-sm text-muted-foreground">{{ formatUsd(usdValue) }}</p>
            <button
              v-if="selectedToken"
              @click="setMax"
              class="text-xs font-semibold text-primary hover:text-primary/80 px-2.5 py-1 rounded-full bg-primary/10 transition-colors"
            >
              MAX
            </button>
          </div>

          <p v-if="selectedToken" class="text-[11px] text-muted-foreground">
            Balance: {{ formatBal(selectedToken.balance) }} {{ selectedToken.symbol }}
          </p>
        </div>

        <!-- Allocation breakdown -->
        <div class="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">{{ activeName }}</span>
            <button @click="step = 1" class="text-[10px] text-primary hover:underline">change</button>
          </div>

          <!-- Visual bar -->
          <div v-if="allocationPreview.length > 0" class="flex h-3 rounded-full overflow-hidden bg-secondary">
            <div
              v-for="item in allocationPreview"
              :key="item.label"
              class="h-full transition-all"
              :style="{ width: item.percentage + '%', backgroundColor: vaultColors[item.label] || 'var(--primary)' }"
            />
          </div>

          <!-- Breakdown rows -->
          <div class="space-y-1.5">
            <div
              v-for="item in allocationPreview"
              :key="item.label"
              class="flex justify-between items-center"
            >
              <span class="text-xs text-muted-foreground flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full inline-block shrink-0" :style="{ backgroundColor: vaultColors[item.label] }" />
                {{ item.label }} · {{ item.percentage }}%
              </span>
              <span class="text-xs font-mono font-medium">{{ formatUsd(item.usdAmount) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ Step 4: Processing ═══ -->
      <div v-else-if="step === 4" class="flex-1 flex flex-col items-center justify-center p-8 space-y-5">
        <!-- Success -->
        <template v-if="txSuccess">
          <div class="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
            <Icon name="lucide:check-circle-2" class="w-8 h-8 text-green-400" />
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-lg font-bold">Stash Created!</h3>
            <p class="text-sm text-muted-foreground">Your deposit has been confirmed.</p>
          </div>
        </template>

        <!-- Error -->
        <template v-else-if="txError">
          <div class="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center">
            <Icon name="lucide:x-circle" class="w-8 h-8 text-destructive" />
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-lg font-bold">Transaction Failed</h3>
            <p class="text-sm text-muted-foreground max-w-xs">{{ txError }}</p>
          </div>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" @click="close">Close</Button>
            <Button size="sm" @click="retryInvest">Try Again</Button>
          </div>
        </template>

        <!-- Processing -->
        <template v-else>
          <div class="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
            <Icon name="lucide:loader-2" class="w-8 h-8 text-primary animate-spin" />
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-lg font-bold">Processing</h3>
            <p class="text-sm text-muted-foreground">{{ txStatus || 'Preparing transactions...' }}</p>
          </div>
          <p class="text-xs text-muted-foreground/60">Please confirm in your wallet when prompted</p>
        </template>
      </div>

      <!-- ═══ Footer ═══ -->
      <div v-if="step < 4" class="shrink-0 flex items-center gap-3 px-5 py-4 border-t border-border bg-card/30">
        <Button
          v-if="step > 1"
          variant="ghost"
          size="sm"
          @click="goBack"
          class="px-3"
        >
          <Icon name="lucide:arrow-left" class="w-4 h-4 mr-1" />
          Back
        </Button>
        <div class="flex-1" />
        <Button
          @click="goNext"
          :disabled="!canNext"
          size="lg"
          class="px-8"
        >
          {{ step === 3 ? "Confirm & Invest" : "Continue" }}
          <Icon v-if="step < 3" name="lucide:arrow-right" class="w-4 h-4 ml-1.5" />
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
