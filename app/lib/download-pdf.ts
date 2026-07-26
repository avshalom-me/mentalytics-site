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

    // Lay the capture onto an A4-width page (proportional height) so the file
    // opens at a sensible size instead of a giant pixel-sized page.
    const pageWidthMm = 210; // A4 width
    const pageHeightMm = (canvas.height / canvas.width) * pageWidthMm;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pageWidthMm, pageHeightMm],
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, pageHeightMm);

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
