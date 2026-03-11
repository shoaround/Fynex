<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { TokenInfo } from "~/config/tokens";

const {
  tokenIn,
  tokenOut,
  amountIn,
  quote,
  isQuoting,
  isSwapping,
  swapStatus,
  error,
  needsApproval,
  executeSwap,
  switchTokens,
  tokens,
} = useSwap();

const onSelectTokenIn = (e: Event) => {
  const symbol = (e.target as HTMLSelectElement).value;
  const token = tokens.find((t: TokenInfo) => t.symbol === symbol);
  if (token) tokenIn.value = token;
};

const onSelectTokenOut = (e: Event) => {
  const symbol = (e.target as HTMLSelectElement).value;
  const token = tokens.find((t: TokenInfo) => t.symbol === symbol);
  if (token) tokenOut.value = token;
};

const buttonLabel = computed(() => {
  if (isSwapping.value) return swapStatus.value || "Processing...";
  if (isQuoting.value) return "Fetching quote...";
  if (!amountIn.value || Number(amountIn.value) <= 0) return "Enter an amount";
  if (error.value) return "Exchange";
  if (!quote.value) return "Fetching quote...";
  if (needsApproval.value) return "Approve & Exchange";
  return "Exchange";
});

const isButtonDisabled = computed(() => {
  return (
    isSwapping.value ||
    isQuoting.value ||
    !amountIn.value ||
    Number(amountIn.value) <= 0 ||
    !quote.value ||
    !!error.value
  );
});
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-lg">Exchange</CardTitle>
      <CardDescription>Convert between currencies at the best available rate</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Token In -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-muted-foreground">You pay</label>
        <div class="flex gap-2">
          <select
            :value="tokenIn.symbol"
            @change="onSelectTokenIn"
            class="h-10 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option
              v-for="token in tokens"
              :key="token.symbol"
              :value="token.symbol"
              :disabled="token.symbol === tokenOut.symbol"
            >
              {{ token.symbol }}
            </option>
          </select>
          <Input
            type="number"
            placeholder="0.0"
            v-model="amountIn"
            :disabled="isSwapping"
            class="flex-1"
          />
        </div>
      </div>

      <!-- Switch button -->
      <div class="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          @click="switchTokens"
          :disabled="isSwapping"
          class="h-8 w-8 rounded-full p-0"
        >
          <Icon name="lucide:arrow-down-up" class="h-4 w-4" />
        </Button>
      </div>

      <!-- Token Out -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-muted-foreground">You receive</label>
        <div class="flex gap-2">
          <select
            :value="tokenOut.symbol"
            @change="onSelectTokenOut"
            class="h-10 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option
              v-for="token in tokens"
              :key="token.symbol"
              :value="token.symbol"
              :disabled="token.symbol === tokenIn.symbol"
            >
              {{ token.symbol }}
            </option>
          </select>
          <div
            class="flex-1 flex items-center h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm font-mono"
          >
            {{ quote?.amountOutFormatted ? Number(quote.amountOutFormatted).toFixed(6) : "—" }}
          </div>
        </div>
      </div>

      <!-- Quote Details -->
      <div
        v-if="quote"
        class="rounded-lg bg-secondary/50 px-4 py-3 space-y-1 text-sm text-muted-foreground"
      >
        <div v-if="quote.priceImpact" class="flex justify-between">
          <span>Price Impact</span>
          <span>{{ quote.priceImpact }}%</span>
        </div>
        <div class="flex justify-between">
          <span>Estimated Gas</span>
          <span>{{ Number(quote.gas).toLocaleString() }}</span>
        </div>
      </div>

      <!-- Error -->
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

      <!-- Swap Status -->
      <p v-if="isSwapping && swapStatus" class="text-sm text-muted-foreground">
        {{ swapStatus }}
      </p>

      <!-- Action Button -->
      <Button
        @click="executeSwap"
        :disabled="isButtonDisabled"
        class="w-full"
      >
        {{ buttonLabel }}
      </Button>
    </CardContent>
  </Card>
</template>
