import { EnsoClient } from "@ensofinance/sdk";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody(event);

  const enso = new EnsoClient({
    apiKey: config.ensoApiKey as string,
  });

  const params = {
    chainId: body.chainId,
    fromAddress: body.fromAddress,
    receiver: body.receiver ?? body.fromAddress,
    spender: body.fromAddress,
    tokenIn: [body.tokenIn],
    tokenOut: [body.tokenOut],
    amountIn: [String(body.amountIn)],
    slippage: String(body.slippage ?? 100),
    routingStrategy: body.routingStrategy ?? "router",
  };

  console.log("[enso/route] params:", JSON.stringify(params));

  try {
    const route = await enso.getRouteData(params);
    return route;
  } catch (err: any) {
    const detail = err?.response?.data || err?.cause || err;
    console.error("[enso/route] error:", err?.message, JSON.stringify(detail, null, 2));
    throw createError({
      statusCode: err?.statusCode || err?.response?.status || 500,
      message: err?.response?.data?.message || err?.message || "Enso route failed",
    });
  }
});
