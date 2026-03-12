import { jsPDF } from "jspdf";

type StashAllocation = {
  vaultId: string;
  label: string;
  underlyingSymbol: string;
  amount: number;
  valueUsd: number;
  percentage: number;
  pnlToken: number;
  pnlUsd: number;
};

type HistoryItem = {
  type: string;
  vaultLabel: string;
  blockTimestamp: number;
  assets: { formatted: string };
  transactionHash: string;
};

export function useExportPdf() {
  const exportStashPdf = (params: {
    address: string;
    totalUsd: number;
    totalPnlUsd: number;
    allocations: StashAllocation[];
    history: HistoryItem[];
  }) => {
    const { address, totalUsd, totalPnlUsd, allocations, history } = params;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    const formatUsd = (v: number) => {
      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
      if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
      if (v > 0 && v < 0.01) return "< $0.01";
      return `$${v.toFixed(2)}`;
    };

    const formatDate = (ts: number) => {
      const d = new Date(ts * 1000);
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    // ── Header ──
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Fynex", margin, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("Portfolio Report", margin + 40, y);
    y += 6;

    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, y);
    y += 4;
    const masked = `${address.slice(0, 6)}****${address.slice(-4)}`;
    doc.text(`Wallet: ${masked}`, margin, y);
    y += 10;

    // ── Divider ──
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // ── Summary ──
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Portfolio Summary", margin, y);
    y += 8;

    doc.setFontSize(24);
    doc.text(formatUsd(totalUsd), margin, y);
    y += 12;

    // ── Allocations table ──
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    // Table header
    const col1 = margin;
    const col2 = margin + 50;
    const col3 = margin + 90;
    const col4 = margin + 130;

    doc.text("Vault", col1, y);
    doc.text("Allocation", col2, y);
    doc.text("Value", col3, y);
    doc.text("PNL", col4, y);
    y += 2;
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    for (const alloc of allocations) {
      doc.setTextColor(0);
      doc.text(alloc.label, col1, y);
      doc.text(`${alloc.percentage.toFixed(0)}%`, col2, y);
      doc.text(formatUsd(alloc.valueUsd), col3, y);

      if (alloc.pnlUsd !== 0) {
        const c = alloc.pnlUsd >= 0 ? [34, 197, 94] : [239, 68, 68];
        doc.setTextColor(c[0]!, c[1]!, c[2]!);
        doc.text(`${alloc.pnlUsd >= 0 ? "+" : "-"}${formatUsd(Math.abs(alloc.pnlUsd))}`, col4, y);
      } else {
        doc.setTextColor(150);
        doc.text("—", col4, y);
      }

      y += 5;

      // Token amount subtitle
      doc.setTextColor(150);
      doc.setFontSize(8);
      doc.text(`${alloc.amount.toFixed(4)} ${alloc.underlyingSymbol}`, col1 + 2, y);
      doc.setFontSize(9);
      y += 7;
    }

    y += 5;

    // ── Transaction History ──
    if (history.length > 0) {
      // Check if we need a new page
      if (y > 230) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Transaction History", margin, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");

      const hCol1 = margin;
      const hCol2 = margin + 30;
      const hCol3 = margin + 70;
      const hCol4 = margin + 110;

      doc.text("Type", hCol1, y);
      doc.text("Vault", hCol2, y);
      doc.text("Amount", hCol3, y);
      doc.text("Date", hCol4, y);
      y += 2;
      doc.setDrawColor(220);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");

      const drawHistoryHeader = () => {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Type", hCol1, y);
        doc.text("Vault", hCol2, y);
        doc.text("Amount", hCol3, y);
        doc.text("Date", hCol4, y);
        y += 2;
        doc.setDrawColor(220);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
      };

      for (let i = 0; i < history.length; i++) {
        const tx = history[i]!;

        if (y > 275) {
          doc.addPage();
          y = 20;
          drawHistoryHeader();
        }

        doc.setTextColor(0);
        doc.text(tx.type.charAt(0).toUpperCase() + tx.type.slice(1), hCol1, y);
        doc.text(tx.vaultLabel, hCol2, y);
        doc.text(tx.assets.formatted, hCol3, y);
        doc.setTextColor(120);
        doc.text(formatDate(tx.blockTimestamp), hCol4, y);
        y += 6;
      }
    }

    // ── Footer ──
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(180);
      doc.text(
        "Generated by Fynex · fynex.xyz · Data from Yo Protocol on Base",
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" },
      );
    }

    doc.save(`fynex-portfolio-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return { exportStashPdf };
}
