<script setup lang="ts">
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { VisuallyHidden } from "reka-ui";
import type { VaultInfo } from "~/composables/useYoProtocol";
import { formatUnits } from "viem";

type StashAlloc = {
  vaultId: string;
  label: string;
  underlyingSymbol: string;
  amount: number;
  valueUsd: number;
  percentage: number;
};

const props = defineProps<{
  open: boolean;
  stashAllocations: StashAlloc[];
  stashTotalUsd: number;
  vaultColors: Record<string, string>;
  txStatus: string | null;
  isWithdrawing: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  withdrawAll: [];
  withdrawPartial: [selections: { vaultId: string; percentage: number }[]];
}>();

type Step = "select" | "processing";
const step = ref<Step>("select");
const mode = ref<"all" | "partial">("all");
const txError = ref<string | null>(null);
const txSuccess = ref(false);

// Partial withdraw sliders (0-100 per vault)
const sliders = ref<Record<string, number>>({});

watch(() => props.open, (v) => {
  if (v) {
    step.value = "select";
    mode.value = "all";
    txError.value = null;
    txSuccess.value = false;
    const s: Record<string, number> = {};
    for (const a of props.stashAllocations) s[a.vaultId] = 100;
    sliders.value = s;
  }
});

watch(() => props.txStatus, (status) => {
  if (!status) return;
  if (status.startsWith("Error:")) {
    txError.value = status.replace("Error: ", "");
  } else if (status === "All withdrawals complete!" || status === "Withdrawal complete!") {
    txSuccess.value = true;
  }
});

watch(() => props.isWithdrawing, (w, prev) => {
  if (prev && !w && txSuccess.value) {
    close();
  }
});

const estimatedWithdraw = computed(() => {
  if (mode.value === "all") return props.stashTotalUsd;
  return props.stashAllocations.reduce((sum, a) => {
    const pct = sliders.value[a.vaultId] ?? 100;
    return sum + (a.valueUsd * pct) / 100;
  }, 0);
});

const hasPartialSelection = computed(() =>
  Object.values(sliders.value).some((v) => v > 0)
);

const confirm = () => {
  txError.value = null;
  txSuccess.value = false;
  step.value = "processing";
  if (mode.value === "all") {
    emit("withdrawAll");
  } else {
    const selections = props.stashAllocations.map((a) => ({
      vaultId: a.vaultId,
      percentage: sliders.value[a.vaultId] ?? 0,
    }));
    emit("withdrawPartial", selections);
  }
};

const close = () => {
  if (step.value === "processing" && props.isWithdrawing && !txError.value) return;
  emit("update:open", false);
};

const formatUsd = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD" });

const formatTokenAmount = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
};
</script>

<template>
  <Dialog :open="open" @update:open="(v: boolean) => v ? null : close()">
    <DialogContent class="sm:max-w-md p-0 overflow-hidden max-h-[85vh] flex flex-col" aria-describedby="withdraw-modal-desc">
      <VisuallyHidden><DialogTitle>Withdraw</DialogTitle></VisuallyHidden>

      <!-- ═══ Select step ═══ -->
      <div v-if="step === 'select'" class="flex-1 overflow-y-auto p-5 space-y-4">
        <div class="text-center space-y-2">
          <div class="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Icon name="lucide:arrow-up-right" class="w-6 h-6 text-destructive" />
          </div>
          <h3 class="text-lg font-bold">Withdraw Stash</h3>
          <p id="withdraw-modal-desc" class="text-sm text-muted-foreground">
            Choose how much to withdraw from your positions.
          </p>
        </div>

        <!-- Mode toggle -->
        <div class="flex rounded-lg border border-border overflow-hidden">
          <button
            @click="mode = 'all'"
            class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
            :class="mode === 'all' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary/50'"
          >
            Withdraw All
          </button>
          <button
            @click="mode = 'partial'"
            class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
            :class="mode === 'partial' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary/50'"
          >
            Custom
          </button>
        </div>

        <!-- Vault breakdown -->
        <div class="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
          <div
            v-for="alloc in stashAllocations"
            :key="alloc.vaultId"
            class="space-y-1.5"
          >
            <div class="flex justify-between items-center">
              <span class="flex items-center gap-1.5 text-sm font-medium">
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: vaultColors[alloc.vaultId] }" />
                {{ alloc.label }}
              </span>
              <span class="text-sm font-mono">
                <template v-if="mode === 'partial'">
                  {{ formatTokenAmount(alloc.amount * (sliders[alloc.vaultId] ?? 100) / 100) }}
                </template>
                <template v-else>
                  {{ formatTokenAmount(alloc.amount) }}
                </template>
                {{ alloc.underlyingSymbol }}
              </span>
            </div>

            <!-- Partial slider -->
            <div v-if="mode === 'partial'" class="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                v-model.number="sliders[alloc.vaultId]"
                class="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-primary bg-secondary"
              />
              <span class="text-xs font-mono font-bold w-10 text-right tabular-nums">
                {{ sliders[alloc.vaultId] ?? 100 }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Estimated value -->
        <div class="text-center">
          <p class="text-xs text-muted-foreground">Estimated withdrawal</p>
          <p class="text-2xl font-bold">{{ formatUsd(estimatedWithdraw) }}</p>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <Button variant="outline" class="flex-1" @click="close">Cancel</Button>
          <Button
            variant="destructive"
            class="flex-1"
            @click="confirm"
            :disabled="mode === 'partial' && !hasPartialSelection"
          >
            Confirm Withdraw
          </Button>
        </div>
      </div>

      <!-- ═══ Processing step ═══ -->
      <div v-else class="flex-1 flex flex-col items-center justify-center p-8 space-y-5">
        <!-- Success -->
        <template v-if="txSuccess">
          <div class="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
            <Icon name="lucide:check-circle-2" class="w-8 h-8 text-green-400" />
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-lg font-bold">Withdrawal Complete!</h3>
            <p class="text-sm text-muted-foreground">Your tokens have been returned to your wallet.</p>
          </div>
        </template>

        <!-- Error -->
        <template v-else-if="txError">
          <div class="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center">
            <Icon name="lucide:x-circle" class="w-8 h-8 text-destructive" />
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-lg font-bold">Withdrawal Failed</h3>
            <p class="text-sm text-muted-foreground max-w-xs">{{ txError }}</p>
          </div>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" @click="close">Close</Button>
            <Button size="sm" @click="step = 'select'">Try Again</Button>
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
    </DialogContent>
  </Dialog>
</template>
