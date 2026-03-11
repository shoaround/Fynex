<script setup lang="ts">
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { VERIFIED_TOKENS } from "~/config/verified-tokens";

export type TokenBalance = {
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
  address: `0x${string}`;
}>();

const emit = defineEmits<{
  select: [token: TokenBalance];
}>();

const { getBalances } = useEnso();

const tokens = ref<TokenBalance[]>([]);
const isLoading = ref(false);
const error = ref("");
const selectedToken = ref<TokenBalance | null>(null);

const fetchBalances = async () => {
  if (!props.address) return;
  isLoading.value = true;
  error.value = "";
  try {
    const raw = await getBalances(props.address);
    const parsed = raw
      .filter((t) => {
        // Only show CoinGecko-verified tokens
        if (!VERIFIED_TOKENS.has(t.token.toLowerCase())) return false;
        // Must have balance > 0
        const balance = Number(t.amount) / 10 ** t.decimals;
        return balance > 0;
      })
      .map((t) => {
        const balance = Number(t.amount) / 10 ** t.decimals;
        const price = Number(t.price);
        return {
          ...t,
          balance,
          valueUsd: balance * price,
        };
      })
      // Sort by USD value descending
      .sort((a, b) => b.valueUsd - a.valueUsd);

    tokens.value = parsed;
  } catch (err: any) {
    error.value = err.message || "Failed to load balances";
  } finally {
    isLoading.value = false;
  }
};

const totalValue = computed(() =>
  tokens.value.reduce((sum, t) => sum + t.valueUsd, 0)
);

const selectToken = (token: TokenBalance) => {
  selectedToken.value = token;
  emit("select", token);
};

const formatUsd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatBalance = (value: number) => {
  if (value < 0.0001) return "< 0.0001";
  if (value < 1) return value.toFixed(4);
  if (value < 1000) return value.toFixed(2);
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

// Fetch on mount and when address changes
onMounted(fetchBalances);
watch(() => props.address, fetchBalances);
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex justify-between items-center">
        <div>
          <CardTitle class="text-lg">Your Wallet</CardTitle>
          <p class="text-sm text-muted-foreground mt-1">
            Select a token to invest with
          </p>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="tokens.length > 0" class="text-sm font-semibold text-foreground">
            {{ formatUsd(totalValue) }}
          </span>
          <Button
            variant="ghost"
            size="sm"
            @click="fetchBalances"
            :disabled="isLoading"
            class="h-8 w-8 p-0"
          >
            <Icon
              name="lucide:refresh-cw"
              class="w-4 h-4"
              :class="isLoading ? 'animate-spin' : ''"
            />
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <!-- Loading -->
      <div v-if="isLoading && tokens.length === 0" class="space-y-3">
        <div v-for="i in 3" :key="i" class="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-3 animate-pulse">
          <div class="w-9 h-9 rounded-full bg-secondary" />
          <div class="flex-1 space-y-2">
            <div class="h-3 bg-secondary rounded w-20" />
            <div class="h-2 bg-secondary rounded w-32" />
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-4">
        <p class="text-sm text-destructive">{{ error }}</p>
        <Button variant="outline" size="sm" class="mt-2" @click="fetchBalances">
          Try again
        </Button>
      </div>

      <!-- Empty -->
      <div v-else-if="tokens.length === 0 && !isLoading" class="text-center py-6">
        <Icon name="lucide:wallet" class="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p class="text-sm text-muted-foreground">No tokens found in your wallet</p>
      </div>

      <!-- Token List -->
      <div v-else class="space-y-1.5">
        <button
          v-for="token in tokens"
          :key="token.token"
          @click="selectToken(token)"
          class="w-full flex items-center gap-3 rounded-lg px-4 py-3 transition-colors text-left"
          :class="
            selectedToken?.token === token.token
              ? 'bg-primary/10 border border-primary/30'
              : 'bg-secondary/30 hover:bg-secondary/50 border border-transparent'
          "
        >
          <!-- Token icon -->
          <div class="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
            <img
              v-if="token.logoUri"
              :src="token.logoUri"
              :alt="token.symbol"
              class="w-9 h-9 rounded-full"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <span v-else class="text-xs font-bold">{{ token.symbol.slice(0, 2) }}</span>
          </div>

          <!-- Token info -->
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-center">
              <span class="font-semibold text-sm">{{ token.symbol }}</span>
              <span class="font-semibold text-sm">{{ formatUsd(token.valueUsd) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-muted-foreground truncate">{{ token.name }}</span>
              <span class="text-xs text-muted-foreground">
                {{ formatBalance(token.balance) }} {{ token.symbol }}
              </span>
            </div>
          </div>

          <!-- Selected indicator -->
          <div v-if="selectedToken?.token === token.token" class="shrink-0">
            <Icon name="lucide:check-circle-2" class="w-5 h-5 text-primary" />
          </div>
        </button>
      </div>
    </CardContent>
  </Card>
</template>
