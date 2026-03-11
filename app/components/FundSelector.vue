<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  FUND_PRESETS,
  VAULT_DEFS,
  buildAllocations,
  type FundPreset,
  type VaultId,
  type VaultAllocation,
} from "~/config/fund";
import type { VaultInfo } from "~/composables/useYoProtocol";

const props = defineProps<{
  vaults: VaultInfo[];
  loading: boolean;
  computeWeightedApy: (allocations: VaultAllocation[]) => number;
}>();

const emit = defineEmits<{
  select: [allocations: VaultAllocation[], name: string];
}>();

type FundMode = "preset" | "custom";

const mode = ref<FundMode>("preset");
const selectedPresetId = ref(FUND_PRESETS[1]!.id); // default: balanced

const customSliders = ref<Record<VaultId, number>>({
  yoUSD: 34,
  yoETH: 33,
  yoBTC: 33,
});

const customTotal = computed(() =>
  Object.values(customSliders.value).reduce((a, b) => a + b, 0)
);

const isCustomValid = computed(() => customTotal.value === 100);

const selectedPreset = computed(() =>
  FUND_PRESETS.find((f) => f.id === selectedPresetId.value) ?? FUND_PRESETS[1]!
);

const activeAllocations = computed(() => {
  const allocs = mode.value === "custom"
    ? buildAllocations(customSliders.value)
    : buildAllocations(selectedPreset.value.allocations);
  return [...allocs].sort((a, b) => b.percentage - a.percentage);
});

const activeName = computed(() => {
  if (mode.value === "custom") return "Custom Portfolio";
  return selectedPreset.value.name;
});

const weightedApy = computed(() =>
  props.computeWeightedApy(activeAllocations.value)
);

const riskColors: Record<string, string> = {
  low: "bg-green-500/15 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  high: "bg-red-500/15 text-red-400 border-red-500/30",
};

const selectPreset = (preset: FundPreset) => {
  mode.value = "preset";
  selectedPresetId.value = preset.id;
};

const switchToCustom = () => {
  mode.value = "custom";
};

const adjustSlider = (vaultId: VaultId, value: number) => {
  customSliders.value[vaultId] = Math.max(0, Math.min(100, value));
};

// Emit whenever allocation changes
watch(
  activeAllocations,
  (allocs) => {
    if (mode.value === "preset" || isCustomValid.value) {
      emit("select", allocs, activeName.value);
    }
  },
  { immediate: true, deep: true },
);

const getVaultApy = (vaultId: VaultId) => {
  const vault = props.vaults.find((v) => v.vaultId === vaultId);
  return Number(vault?.snapshot?.stats?.yield?.["30d"] ?? 0);
};

const getVaultTvlFormatted = (vaultId: VaultId): string => {
  const vault = props.vaults.find((v) => v.vaultId === vaultId);
  const tvl = vault?.snapshot?.stats?.tvl;
  if (!tvl) return '';
  if (typeof tvl === 'object' && tvl.formatted) return tvl.formatted.startsWith('$') ? tvl.formatted : `$${tvl.formatted}`;
  return '';
};
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex justify-between items-center">
        <CardTitle class="text-lg">Choose Portfolio</CardTitle>
        <Badge
          v-if="activeAllocations.length > 0"
          class="bg-primary/15 text-primary border-primary/30"
        >
          ~{{ weightedApy.toFixed(2) }}% annual return
        </Badge>
      </div>
      <CardDescription>
        Select a strategy or create your own portfolio mix
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Preset Tabs -->
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="preset in FUND_PRESETS"
          :key="preset.id"
          @click="selectPreset(preset)"
          class="rounded-lg border px-3 py-2.5 text-left transition-colors"
          :class="mode === 'preset' && selectedPresetId === preset.id
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/40'"
        >
          <div class="text-sm font-semibold">{{ preset.name }}</div>
          <Badge
            variant="outline"
            class="mt-1 text-[10px] px-1.5 py-0"
            :class="riskColors[preset.risk]"
          >
            {{ preset.risk }}
          </Badge>
        </button>
        <button
          @click="switchToCustom"
          class="rounded-lg border px-3 py-2.5 text-left transition-colors"
          :class="mode === 'custom'
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/40'"
        >
          <div class="text-sm font-semibold">Custom</div>
          <Badge
            variant="outline"
            class="mt-1 text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground"
          >
            your way
          </Badge>
        </button>
      </div>

      <!-- Custom Sliders -->
      <div v-if="mode === 'custom'" class="space-y-3">
        <div
          v-for="def in VAULT_DEFS"
          :key="def.vaultId"
          class="space-y-1"
        >
          <div class="flex justify-between items-center text-sm">
            <span class="font-medium">{{ def.label }}</span>
            <span class="font-mono text-muted-foreground">{{ customSliders[def.vaultId] }}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            :value="customSliders[def.vaultId]"
            @input="adjustSlider(def.vaultId, Number(($event.target as HTMLInputElement).value))"
            class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary bg-secondary"
          />
        </div>
        <div class="flex justify-between items-center text-sm">
          <span class="font-medium">Total</span>
          <span
            class="font-mono font-semibold"
            :class="isCustomValid ? 'text-primary' : 'text-destructive'"
          >
            {{ customTotal }}%
          </span>
        </div>
        <p v-if="!isCustomValid" class="text-xs text-destructive">
          Allocation must add up to 100%
        </p>
      </div>

      <!-- Allocation Breakdown -->
      <div class="space-y-3">
        <div
          v-for="alloc in activeAllocations"
          :key="alloc.vaultId"
          class="rounded-lg bg-secondary/50 px-4 py-3 space-y-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="font-semibold text-sm">{{ alloc.label }}</span>
              <Badge variant="outline" class="font-mono text-xs border-primary/40 text-primary">
                {{ alloc.percentage }}%
              </Badge>
            </div>
            <div class="text-right text-sm text-muted-foreground space-x-3">
              <span v-if="loading">Loading...</span>
              <template v-else>
                <span v-if="getVaultApy(alloc.vaultId)">
                  {{ getVaultApy(alloc.vaultId).toFixed(2) }}% annual
                </span>
                <span v-if="getVaultTvlFormatted(alloc.vaultId)">
                  {{ getVaultTvlFormatted(alloc.vaultId) }} invested
                </span>
              </template>
            </div>
          </div>
          <!-- Progress bar -->
          <div class="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div
              class="h-full rounded-full bg-primary transition-all duration-300"
              :style="{ width: alloc.percentage + '%' }"
            />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
