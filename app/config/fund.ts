import { VAULTS } from "@yo-protocol/core";

export type VaultId = "yoUSD" | "yoETH" | "yoBTC";

export type VaultDef = {
  vaultId: VaultId;
  label: string;
  address: `0x${string}`;
  underlyingSymbol: string;
  underlyingDecimals: number;
};

export type VaultAllocation = VaultDef & {
  percentage: number;
};

export type FundPreset = {
  id: string;
  name: string;
  description: string;
  risk: "low" | "medium" | "high";
  allocations: Record<VaultId, number>; // percentage per vault
};

export const CHAIN_ID = 8453; // Base mainnet

export const VAULT_DEFS: VaultDef[] = [
  {
    vaultId: "yoUSD",
    label: "yoUSD",
    address: VAULTS.yoUSD.address as `0x${string}`,
    underlyingSymbol: "USDC",
    underlyingDecimals: 6,
  },
  {
    vaultId: "yoETH",
    label: "yoETH",
    address: VAULTS.yoETH.address as `0x${string}`,
    underlyingSymbol: "WETH",
    underlyingDecimals: 18,
  },
  {
    vaultId: "yoBTC",
    label: "yoBTC",
    address: VAULTS.yoBTC.address as `0x${string}`,
    underlyingSymbol: "cbBTC",
    underlyingDecimals: 8,
  },
];

export const FUND_PRESETS: FundPreset[] = [
  {
    id: "conservative",
    name: "Conservative",
    description: "Focused on stability with steady, predictable returns",
    risk: "low",
    allocations: { yoUSD: 50, yoETH: 25, yoBTC: 25 },
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "A mix of growth and stability for balanced returns",
    risk: "medium",
    allocations: { yoUSD: 35, yoETH: 35, yoBTC: 30 },
  },
  {
    id: "aggressive",
    name: "Aggressive",
    description: "Targets higher returns with more growth-oriented assets",
    risk: "high",
    allocations: { yoUSD: 10, yoETH: 45, yoBTC: 45 },
  },
];

export function buildAllocations(percentages: Record<VaultId, number>): VaultAllocation[] {
  return VAULT_DEFS.map((def) => ({
    ...def,
    percentage: percentages[def.vaultId],
  })).filter((a) => a.percentage > 0);
}

// Legacy compat
export const FUND_NAME = "Balanced Fund";
export const FUND_ALLOCATIONS: VaultAllocation[] = buildAllocations(
  FUND_PRESETS.find((f) => f.id === "balanced")!.allocations,
);
