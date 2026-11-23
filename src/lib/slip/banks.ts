export type BankInfo = { code: string; name: string; patterns: RegExp[] };

// Bank codes follow the Bank of Thailand 3-digit codes (used in slip QR codes).
export const BANKS: BankInfo[] = [
  { code: "004", name: "กสิกรไทย", patterns: [/กสิกร/, /k\s?plus/i, /kbank/i, /kasikorn/i, /make\s*by\s*kbank/i] },
  { code: "014", name: "ไทยพาณิชย์", patterns: [/ไทยพาณิชย์/, /\bscb\b/i, /siam\s*commercial/i] },
  { code: "006", name: "กรุงไทย", patterns: [/กรุงไทย/, /krungthai/i, /krung\s*thai/i, /\bktb\b/i, /เป๋าตัง/] },
  { code: "002", name: "กรุงเทพ", patterns: [/ธนาคารกรุงเทพ/, /ธ\.?\s?กรุงเทพ/, /bangkok\s*bank/i, /\bbbl\b/i, /bualuang/i] },
  { code: "025", name: "กรุงศรีอยุธยา", patterns: [/กรุงศรี/, /krungsri/i, /\bkma\b/i, /\bbay\b/i] },
  { code: "011", name: "ทีทีบี", patterns: [/ทีทีบี/, /\bttb\b/i, /ทหารไทยธนชาต/, /tmbthanachart/i] },
  { code: "030", name: "ออมสิน", patterns: [/ออมสิน/, /\bgsb\b/i, /mymo/i] },
  { code: "034", name: "ธ.ก.ส.", patterns: [/ธ\.?\s?ก\.?\s?ส(?![ั-ฺ็-๎])\.?/, /\bbaac\b/i, /ธนาคารเพื่อการเกษตร/] },
  { code: "033", name: "อาคารสงเคราะห์", patterns: [/อาคารสงเคราะห์/, /\bghb\b/i] },
  { code: "024", name: "ยูโอบี", patterns: [/ยูโอบี/, /\buob\b/i] },
  { code: "022", name: "ซีไอเอ็มบี ไทย", patterns: [/ซีไอเอ็มบี/, /\bcimb\b/i] },
  { code: "069", name: "เกียรตินาคินภัทร", patterns: [/เกียรตินาคิน/, /\bkkp\b/i] },
  { code: "067", name: "ทิสโก้", patterns: [/ทิสโก้/, /\btisco\b/i] },
  { code: "073", name: "แลนด์ แอนด์ เฮ้าส์", patterns: [/แลนด์\s*แอนด์\s*เฮ้าส์/, /lh\s*bank/i] },
  { code: "000", name: "TrueMoney Wallet", patterns: [/truemoney/i, /ทรูมันนี่/] },
];

export function bankByCode(code: string | null | undefined): BankInfo | undefined {
  if (!code) return undefined;
  return BANKS.find((b) => b.code === code.padStart(3, "0"));
}

/** Banks mentioned in the text, in order of first appearance. */
export function detectBanks(text: string): BankInfo[] {
  const hits: { bank: BankInfo; index: number }[] = [];
  for (const bank of BANKS) {
    let best = -1;
    for (const p of bank.patterns) {
      const m = p.exec(text);
      if (m && (best === -1 || m.index < best)) best = m.index;
    }
    if (best >= 0) hits.push({ bank, index: best });
  }
  return hits.sort((a, b) => a.index - b.index).map((h) => h.bank);
}
