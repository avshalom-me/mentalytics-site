// Capture a DOM element to canvas and bundle it into a downloadable PDF.
// Works on iOS Safari where `window.print()` requires multi-tap gymnastics
// in the share sheet - here the user gets a real file download instead.
//
// Dynamic imports keep the ~200KB of html2canvas + jspdf out of the main bundle.

export async function downloadResultsPDF(
  elementId: string,
  baseFilename: string,
  backgroundColor: string = "#1a3a5c",
): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) return;

  const btn = document.getElementById(`${elementId.split("-").slice(0, 2).join("-")}-download-pdf-btn`)
    ?? document.querySelector<HTMLButtonElement>(`button[data-pdf-trigger="${elementId}"]`);
  const originalLabel = btn?.textContent ?? "";
  if (btn) {
    btn.setAttribute("disabled", "true");
    btn.textContent = "מייצר PDF…";
  }

  try {
    const [{ default: html2canvas }, jsPDFMod] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
    ]);
    const jsPDF = jsPDFMod.jsPDF;

    // Expand any collapsed <details> first: html2canvas paints their hidden
    // content in place without reserving layout height, so a closed <details>
    // bleeds over the elements below it. Opening them lays the content out in
    // normal flow (and includes the tools in the saved report). Restored after.
    const detailsEls = Array.from(el.querySelectorAll("details"));
    const prevOpen = detailsEls.map((d) => d.open);
    detailsEls.forEach((d) => { d.open = true; });

    // Capture at 3x for crisp text. html2canvas-pro is used (not html2canvas)
    // because it supports Tailwind v4 oklch() colors - the original threw on them
    // and forced a window.print() fallback.
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(el, {
        scale: 3,
        backgroundColor,
        useCORS: true,
        logging: false,
      });
    } finally {
      detailsEls.forEach((d, i) => { d.open = prevOpen[i]; });
    }

    // Slice the capture into A4 pages. It used to go onto one page of
    // proportional height, which was fine for a parent's short report and
    // became a metre-long sheet once the counsellor's report carried a
    // committee map and a summary underneath. A slice may cut through a line
    // of text at the page edge - the price of capturing pixels rather than
    // laying out text, and better than a page no printer can hold.
    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const pageHeightPx = Math.floor(canvas.width * (pageHeightMm / pageWidthMm));
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));
    for (let i = 0; i < pages; i++) {
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.min(pageHeightPx, canvas.height - i * pageHeightPx);
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context unavailable");
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, i * pageHeightPx, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (i > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageWidthMm, (slice.height / canvas.width) * pageWidthMm);
    }

    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseFilename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    console.error("PDF generation failed", e);
    // Last-resort fallback: open the OS print dialog.
    try { window.print(); } catch {}
  } finally {
    if (btn) {
      btn.removeAttribute("disabled");
      btn.textContent = originalLabel;
    }
  }
}
