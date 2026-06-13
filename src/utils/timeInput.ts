/** 將使用者輸入即時格式化為 HH:MM（僅保留數字並自動補上冒號，最多 4 位數字） */
export function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
