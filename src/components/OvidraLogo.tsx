import { motion } from "framer-motion";
import { OVIDRA_LOGO_LIGHT_B64, OVIDRA_LOGO_DARK_B64 } from "./ovidra_logos_base64";

interface OvidraLogoProps {
  theme: "light" | "dark";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function OvidraLogo({ theme, className, size = "md" }: OvidraLogoProps) {
  let height = 48;
  if (size === "sm") height = 36;
  else if (size === "md") height = 48;
  else if (size === "lg") height = 56;
  else if (size === "xl") height = 68;

  const src = theme === "light" ? OVIDRA_LOGO_LIGHT_B64 : OVIDRA_LOGO_DARK_B64;

  return (
    <motion.div
      className={`${className || ""} flex items-center justify-center`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <img
        src={src}
        alt="Ovidra Logo"
        className="select-none pointer-events-none"
        style={{
          height: `${height}px`,
          width: "auto",
          objectFit: "contain",
        }}
      />
    </motion.div>
  );
}
