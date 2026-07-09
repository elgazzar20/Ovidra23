import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/** Renders a Code128 barcode as an inline SVG. Both the QR and this barcode
 *  carry the student UID and are read by the attendance scanner. */
export function Barcode({ value, height = 40, width = 1.6, color = "#0f172a" }: {
  value: string; height?: number; width?: number; color?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128", height, width, displayValue: false, margin: 0,
        background: "transparent", lineColor: color,
      });
    } catch { /* ignore invalid codes */ }
  }, [value, height, width, color]);
  return <svg ref={ref} className="max-w-full" style={{ height }} />;
}
