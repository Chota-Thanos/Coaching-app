"use client";

// Renders content off-screen and rasterizes it into a PDF (image pages, not
// selectable/embedded text) so saved notes can't be copy-pasted out of the
// exported file. This is a deliberate trade-off requested for this feature —
// it behaves like a scanned document, not a searchable PDF.

export type PdfSection = {
  title: string;
  meta?: string;
  tags?: string[];
  personalNote?: string;
  /** Trusted HTML (already used elsewhere via dangerouslySetInnerHTML) — rendered as-is, not escaped. */
  bodyHtml: string;
};

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function buildSectionHtml(section: PdfSection, isFirst: boolean): string {
  const tagsHtml =
    section.tags && section.tags.length > 0
      ? `<p style="margin:0 0 14px;">${section.tags
          .map(
            (tag) =>
              `<span style="display:inline-block;background:#eef2ff;color:#4f46e5;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;margin-right:6px;">${escapeHtml(tag)}</span>`
          )
          .join("")}</p>`
      : "";

  const noteHtml = section.personalNote
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px;line-height:1.6;white-space:pre-wrap;"><strong>Personal note:</strong> ${escapeHtml(section.personalNote)}</div>`
    : "";

  return `
    <div style="${isFirst ? "" : "margin-top:48px;padding-top:32px;border-top:2px solid #e5e7eb;"}">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;color:#0f172a;">${escapeHtml(section.title)}</h1>
      ${section.meta ? `<p style="font-size:12px;color:#6b7280;margin:0 0 14px;">${escapeHtml(section.meta)}</p>` : ""}
      ${tagsHtml}
      ${noteHtml}
      <div style="font-size:14px;line-height:1.75;color:#1f2937;">${section.bodyHtml}</div>
    </div>
  `;
}

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, text: string): void {
  if (!text.trim()) return;
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 30px Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-30 * Math.PI) / 180);

  const stepX = ctx.measureText(text).width + 110;
  const stepY = 150;
  const span = Math.max(width, height) * 1.5;
  for (let y = -span; y < span; y += stepY) {
    for (let x = -span; x < span; x += stepX) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

export async function downloadScannedPdf(
  sections: PdfSection[],
  filename: string,
  watermarkText = "Personal copy - do not redistribute"
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas")
  ]);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "#ffffff";
  container.style.padding = "40px";
  container.style.fontFamily = "Georgia, 'Times New Roman', serif";
  container.innerHTML = sections.map((section, idx) => buildSectionHtml(section, idx === 0)).join("");
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidthPt = pageWidth;
    const imgHeightPt = (canvas.height * imgWidthPt) / canvas.width;
    const pxPerPt = canvas.height / imgHeightPt;

    let renderedPt = 0;
    let pageIndex = 0;
    while (renderedPt < imgHeightPt) {
      const sliceHeightPt = Math.min(pageHeight, imgHeightPt - renderedPt);
      const sliceHeightPx = Math.max(1, Math.round(sliceHeightPt * pxPerPt));

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(
        canvas,
        0,
        Math.round(renderedPt * pxPerPt),
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );
      drawWatermark(ctx, sliceCanvas.width, sliceCanvas.height, watermarkText);

      const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(sliceData, "JPEG", 0, 0, imgWidthPt, sliceHeightPt);

      renderedPt += sliceHeightPt;
      pageIndex += 1;
    }

    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
