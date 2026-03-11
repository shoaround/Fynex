import { CHAIN_ID } from "~/config/fund";

export function useEnso() {
  const getRoute = async (params: {
    fromAddress: `0x${string}`;
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
    amountIn: string;
    slippage?: number;
    routingStrategy?: string;
  }) => {
    const data = await $fetch("/api/enso/route", {
      method: "POST",
      body: {
        chainId: CHAIN_ID,
        fromAddress: params.fromAddress,
        receiver: params.fromAddress,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        slippage: params.slippage ?? 100,
        routingStrategy: params.routingStrategy ?? "router",
      },
    });
    return data as {
      amountOut: string;
      gas: string;
      priceImpact: string | null;
      tx: { to: string; data: string; value: string };
      route: any[];
    };
  };

  const getApproval = async (params: {
    fromAddress: `0x${string}`;
    tokenAddress: `0x${string}`;
    amount: string;
  }) => {
    const data = await $fetch("/api/enso/approve", {
      method: "POST",
      body: {
        chainId: CHAIN_ID,
        fromAddress: params.fromAddress,
        tokenAddress: params.tokenAddress,
        amount: params.amount,
      },
    });
    return data as {
      amount: string;
      gas: string;
      spender: string;
      token: string;
      tx: { to: string; data: string; value: string };
    };
  };

  const getBalances = async (address: `0x${string}`) => {
    const data = await $fetch("/api/enso/balances", {
      params: {
        address,
        chainId: CHAIN_ID,
      },
    });
    return data as {
      token: string;
      amount: string;
      decimals: number;
      price: string;
      name: string;
      symbol: string;
      logoUri: string;
    }[];
  };

  return { getRoute, getApproval, getBalances };
}
