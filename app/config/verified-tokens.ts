/**
 * CoinGecko-verified tokens on Base (chain 8453).
 * Only tokens in this set will be shown in the wallet balance view.
 * Addresses are lowercased for comparison.
 */
export const VERIFIED_TOKENS: Set<string> = new Set([
  // Native ETH
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  // WETH
  "0x4200000000000000000000000000000000000006",
  // USDC (Bridged)
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  // USDbC (Bridged USDC)
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
  // DAI
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
  // cbETH
  "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22",
  // cbBTC
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
  // AERO
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
  // DEGEN
  "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
  // BRETT
  "0x532f27101965dd16442e59d40670faf5ebb142e4",
  // TOSHI
  "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4",
  // WELL (Moonwell)
  "0xa88594d404727625a9437c3f886c7643872296ae",
  // USDT
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
]);
