import { EnsoClient } from "@ensofinance/sdk";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody(event);

  const enso = new EnsoClient({
    apiKey: config.ensoApiKey as string,
  });

  const approval = await enso.getApprovalData({
    fromAddress: body.fromAddress,
    tokenAddress: body.tokenAddress,
    chainId: body.chainId,
    amount: body.amount,
  });

  return approval;
});
