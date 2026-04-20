import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ExportRenderedPdfOptions {
  filename: string;
  backgroundColor?: string;
  contentWidthPx?: number;
  marginPt?: number;
}

async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  if (images.length === 0) return;

  await Promise.all(
    images.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) return;
      if ((img as HTMLImageElement).decode) {
        try {
          await img.decode();
          return;
        } catch {
          // continue to load event fallback
        }
      }
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    }),
  );
}

/**
 * Export the exact rendered report node to PDF while preserving
 * chart/icon/card styling from the live UI.
 */
export async function exportRenderedReportPdf(
  sourceEl: HTMLElement,
  options: ExportRenderedPdfOptions,
): Promise<void> {
  const {
    filename,
    backgroundColor = "#F4F0E5",
    contentWidthPx = 1400,
    marginPt = 24,
  } = options;

  if ((document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready) {
    await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
  }

  const clone = sourceEl.cloneNode(true) as HTMLElement;
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-100000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${contentWidthPx}px`;
  wrapper.style.background = backgroundColor;
  wrapper.style.padding = "0";
  wrapper.style.zIndex = "-1";
  wrapper.style.pointerEvents = "none";

  clone.style.width = `${contentWidthPx}px`;
  clone.style.minWidth = `${contentWidthPx}px`;
  clone.style.maxWidth = `${contentWidthPx}px`;
  clone.style.margin = "0";
  clone.style.boxShadow = "none";
  clone.style.borderRadius = "0";
  clone.style.overflow = "visible";

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    await waitForImages(clone);

    const canvas = await html2canvas(clone, {
      backgroundColor,
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: contentWidthPx,
      windowHeight: Math.max(clone.scrollHeight, 1200),
      scrollX: 0,
      scrollY: 0,
    });

    const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const contentWidthPt = pageWidth - marginPt * 2;
    const contentHeightPt = pageHeight - marginPt * 2;
    const pageSliceHeightPx = Math.floor((contentHeightPt * canvas.width) / contentWidthPt);

    let yOffsetPx = 0;
    let pageIndex = 0;
    while (yOffsetPx < canvas.height) {
      const sliceHeightPx = Math.min(pageSliceHeightPx, canvas.height - yOffsetPx);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) break;

      ctx.drawImage(
        canvas,
        0,
        yOffsetPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx,
      );

      const sliceData = sliceCanvas.toDataURL("image/png");
      const sliceHeightPt = (sliceHeightPx * contentWidthPt) / canvas.width;

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(sliceData, "PNG", marginPt, marginPt, contentWidthPt, sliceHeightPt, undefined, "FAST");

      yOffsetPx += sliceHeightPx;
      pageIndex += 1;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(wrapper);
  }
}

