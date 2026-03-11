import { parseUnits, formatUnits } from "viem";
import { watchDebounced } from "@vueuse/core";
import { SWAP_TOKENS, type TokenInfo } from "~/config/tokens";

export function useSwap() {
  const { address, sendTx } = useWallet();
  const { getRoute, getApproval } = useEnso();

  const tokenIn = ref<TokenInfo>(SWAP_TOKENS[0]!); // ETH
  const tokenOut = ref<TokenInfo>(SWAP_TOKENS[1]!); // USDC
  const amountIn = ref("");
  const quote = ref<{
    amountOut: string;
    amountOutFormatted: string;
    priceImpact: string | null;
    gas: string;
    tx: { to: string; data: string; value: string };
  } | null>(null);
  const isQuoting = ref(false);
  const isSwapping = ref(false);
  const swapStatus = ref<string | null>(null);
  const error = ref<string | null>(null);

  const needsApproval = computed(() => !tokenIn.value.isNative);

  const fetchQuote = async () => {
    error.value = null;
    quote.value = null;

    if (!address.value || !amountIn.value || Number(amountIn.value) <= 0) return;
    if (tokenIn.value.address === tokenOut.value.address) {
      error.value = "Select different tokens";
      return;
    }

    isQuoting.value = true;
    try {
      const amountInWei = parseUnits(amountIn.value, tokenIn.value.decimals).toString();
      const data = await getRoute({
        fromAddress: address.value,
        tokenIn: tokenIn.value.address,
        tokenOut: tokenOut.value.address,
        amountIn: amountInWei,
      });

      quote.value = {
        amountOut: data.amountOut,
        amountOutFormatted: formatUnits(BigInt(data.amountOut), tokenOut.value.decimals),
        priceImpact: data.priceImpact,
        gas: data.gas,
        tx: data.tx,
      };
    } catch (err: any) {
      error.value = err?.data?.message || err?.message || "Failed to get quote";
    } finally {
      isQuoting.value = false;
    }
  };

  const executeSwap = async () => {
    if (!address.value || !amountIn.value) return;

    isSwapping.value = true;
    error.value = null;
    try {
      const amountInWei = parseUnits(amountIn.value, tokenIn.value.decimals).toString();

      // Step 1: Approve if ERC20
      if (needsApproval.value) {
        swapStatus.value = "Approving token...";
        const approval = await getApproval({
          fromAddress: address.value,
          tokenAddress: tokenIn.value.address,
          amount: amountInWei,
        });
        await sendTx({
          to: approval.tx.to as `0x${string}`,
          data: approval.tx.data as `0x${string}`,
          value: BigInt(approval.tx.value || 0),
        });
      }

      // Step 2: Get fresh route
      swapStatus.value = "Fetching best route...";
      const routeData = await getRoute({
        fromAddress: address.value,
        tokenIn: tokenIn.value.address,
        tokenOut: tokenOut.value.address,
        amountIn: amountInWei,
      });

      // Step 3: Execute swap
      swapStatus.value = "Executing swap...";
      await sendTx({
        to: routeData.tx.to as `0x${string}`,
        data: routeData.tx.data as `0x${string}`,
        value: BigInt(routeData.tx.value || 0),
      });

      swapStatus.value = "Swap complete!";
      amountIn.value = "";
      quote.value = null;
    } catch (err: any) {
      error.value = err?.data?.message || err?.message || "Swap failed";
      swapStatus.value = null;
    } finally {
      isSwapping.value = false;
    }
  };

  const switchTokens = () => {
    const temp = tokenIn.value;
    tokenIn.value = tokenOut.value;
    tokenOut.value = temp;
    quote.value = null;
    error.value = null;
  };

  // Auto-fetch quote when amount changes
  watchDebounced(
    amountIn,
    () => {
      fetchQuote();
    },
    { debounce: 500 },
  );

  // Re-fetch quote when tokens change
  watch([tokenIn, tokenOut], () => {
    quote.value = null;
    if (amountIn.value && Number(amountIn.value) > 0) {
      fetchQuote();
    }
  });

  return {
    tokenIn,
    tokenOut,
    amountIn,
    quote,
    isQuoting,
    isSwapping,
    swapStatus,
    error,
    needsApproval,
    fetchQuote,
    executeSwap,
    switchTokens,
    tokens: SWAP_TOKENS,
  };
}
