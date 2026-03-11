import { EnsoClient } from "@ensofinance/sdk";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);

  const eoaAddress = query.address as string;
  const chainId = Number(query.chainId ?? 8453);

  if (!eoaAddress) {
    throw createError({ statusCode: 400, message: "address is required" });
  }

  const enso = new EnsoClient({
    apiKey: config.ensoApiKey as string,
  });

  const balances = await enso.getBalances({
    chainId,
    eoaAddress: eoaAddress as `0x${string}`,
    useEoa: true,
  });

  return balances;
});
