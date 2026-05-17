// Capture a DOM element to canvas and bundle it into a downloadable PDF.
// Works on iOS Safari where `window.print()` requires multi-tap gymnastics
// in the share sheet — here the user gets a real file download instead.
//
// Dynamic imports keep the ~200KB of html2canvas + jspdf out of the main bundle.

export async function downloadResultsPDF(elementId: string, baseFilename: string): Promise<void> {
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
      import("html2canvas"),
      import("jspdf"),
    ]);
    const jsPDF = jsPDFMod.jsPDF;

    // Capture at 2x for crisp output; oklch() colors confuse html2canvas, so we
    // rely on the inline-cloned styles in the captured DOM.
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#1a3a5c",
      useCORS: true,
      logging: false,
    });

    const imgWidthPx = canvas.width;
    const imgHeightPx = canvas.height;

    // Build a PDF page that matches the captured aspect ratio (single page,
    // sized to the image so nothing gets clipped or rescaled).
    const pdf = new jsPDF({
      orientation: imgHeightPx > imgWidthPx ? "portrait" : "landscape",
      unit: "px",
      format: [imgWidthPx, imgHeightPx],
      hotfixes: ["px_scaling"],
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(imgData, "JPEG", 0, 0, imgWidthPx, imgHeightPx);

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
