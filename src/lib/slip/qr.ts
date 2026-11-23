// Thai bank slips carry a "mini QR" (Slip Verification QR, Bank of Thailand standard).
// Format is EMVCo-like TLV: tag(2) + length(2) + value.
// Tag 00 contains sub-tags: 00 = API id ("000001"), 01 = sending bank code, 02 = transaction ref.
// Tag 51 = country ("TH"), tag 91 = CRC.

export type SlipQr = { sendingBankCode: string; transRef: string };

function parseTlv(s: string): Map<string, string> | null {
  const out = new Map<string, string>();
  let i = 0;
  while (i < s.length) {
    if (i + 4 > s.length) return null;
    const tag = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(len)) return null;
    const val = s.slice(i + 4, i + 4 + len);
    if (val.length !== len) return null;
    out.set(tag, val);
    i += 4 + len;
  }
  return out;
}

export function parseSlipQr(payload: string | null | undefined): SlipQr | null {
  if (!payload) return null;
  const s = payload.trim();
  if (!/^\d{4}/.test(s) || s.length > 200) return null;
  const top = parseTlv(s);
  const inner = top?.get("00");
  if (!inner) return null;
  const sub = parseTlv(inner);
  const bank = sub?.get("01");
  const ref = sub?.get("02");
  if (!bank || !ref || !/^\d{3}$/.test(bank) || !/^[A-Za-z0-9]{6,40}$/.test(ref)) return null;
  // PromptPay payment QRs also start with "00": they have tag 00 = "01" (payload format) and no sub-tags.
  return { sendingBankCode: bank, transRef: ref };
}
