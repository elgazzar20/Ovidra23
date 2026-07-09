/**
 * License Key Cryptographic Management
 * ====================================
 * Allows offline license generation and validation.
 * Supports activations, trials, and discount-based licenses.
 */

export function hashLicense(
  centerId: string,
  plan: string,
  durationDays: number,
  purpose?: string,
  discountValue?: string
): string {
  const secret = "cpd_license_salt_9832";
  const data = `${centerId}:${plan}:${durationDays}:${purpose || ""}:${discountValue || ""}:${secret}`;
  let h = 0;
  for (let i = 0; i < data.length; i++) {
    h = (h << 5) - h + data.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

export function generateLicenseKey(
  centerId: string,
  plan: string,
  durationDays: number,
  purpose?: "activation" | "trial" | "discount",
  discountValue?: string
): string {
  if (purpose && purpose !== "activation") {
    const sig = hashLicense(centerId, plan, durationDays, purpose, discountValue);
    const raw = `v2|${centerId}|${plan}|${durationDays}|${purpose}|${discountValue || ""}|${sig}`;
    return btoa(unescape(encodeURIComponent(raw)));
  } else {
    const sig = hashLicense(centerId, plan, durationDays);
    const raw = `v2|${centerId}|${plan}|${durationDays}|${sig}`;
    return btoa(unescape(encodeURIComponent(raw)));
  }
}

export function verifyLicenseKey(
  keyStr: string,
  centerId: string,
): { 
  valid: boolean; 
  plan?: "free" | "pro" | "enterprise"; 
  startDate?: number; 
  endDate?: number; 
  purpose?: "activation" | "trial" | "discount";
  discountAmount?: number;
  discountReason?: string;
  error?: string; 
} {
  try {
    const raw = decodeURIComponent(escape(atob(keyStr.trim())));
    const parts = raw.split("|");
    
    // Check version
    if (parts[0] !== "v2") {
       return { valid: false, error: "مفتاح ترخيص قديم غير مدعوم، يرجى طلب مفتاح جديد" };
    }

    if (parts.length === 5) {
      const [, cid, plan, durStr, sig] = parts;
      if (cid !== centerId) {
        return { valid: false, error: "هذا المفتاح مخصص لسنتر آخر وليس لهذا السنتر" };
      }
      const durationDays = Number(durStr);
      const expectedSig = hashLicense(cid, plan, durationDays);
      if (sig !== expectedSig) {
        return { valid: false, error: "مفتاح ترخيص غير صالح أو تالف" };
      }
      
      const start = Date.now();
      const end = start + durationDays * 24 * 60 * 60 * 1000;
      
      return {
        valid: true,
        plan: plan as "free" | "pro" | "enterprise",
        startDate: start,
        endDate: end,
        purpose: "activation",
      };
    } else if (parts.length === 7) {
      const [, cid, plan, durStr, purpose, discountVal, sig] = parts;
      if (cid !== centerId) {
        return { valid: false, error: "هذا المفتاح مخصص لسنتر آخر وليس لهذا السنتر" };
      }
      const durationDays = Number(durStr);
      const expectedSig = hashLicense(cid, plan, durationDays, purpose, discountVal);
      if (sig !== expectedSig) {
        return { valid: false, error: "مفتاح ترخيص غير صالح أو تالف" };
      }
      
      const start = Date.now();
      const end = start + durationDays * 24 * 60 * 60 * 1000;
      
      let discAmt: number | undefined;
      let discReason: string | undefined;
      if (purpose === "discount") {
        discAmt = parseFloat(discountVal) || 0;
        discReason = `خصم بموجب كود الترخيص (${discountVal})`;
      }
      
      return {
        valid: true,
        plan: plan as "free" | "pro" | "enterprise",
        startDate: start,
        endDate: end,
        purpose: purpose as "activation" | "trial" | "discount",
        discountAmount: discAmt,
        discountReason: discReason,
      };
    }
    return { valid: false, error: "تنسيق المفتاح غير صحيح" };
  } catch {
    return { valid: false, error: "تنسيق المفتاح غير صحيح" };
  }
}
