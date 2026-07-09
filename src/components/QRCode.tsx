import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "../utils/cn";

export function QRCodeImage({
  value,
  size = 120,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 2,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => active && setSrc(url))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src)
    return (
      <div
        className={cn("animate-pulse rounded-lg bg-elevated", className)}
        style={{ width: size, height: size }}
      />
    );
  return (
    <img
      src={src}
      width={size}
      height={size}
      className={cn("rounded-lg", className)}
      alt="QR code"
    />
  );
}
