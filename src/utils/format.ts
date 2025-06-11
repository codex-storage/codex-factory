/**
 * Converts a number of bytes into a human-readable string with units.
 * @param bytes - The number of bytes to convert.
 * @param decimals - Number of decimal places to include (default is 2).
 * @returns The formatted string in a human-readable format.
 */
export function formatBytes (bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024 // Bytes in a Kilobyte
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const formattedValue = Number.parseFloat((bytes / k**i).toFixed(decimals))

  return `${formattedValue} ${sizes[i]}`
}

/**
 * Formats a long hash by taking a specified number of characters
 * from the start and end of the hash.
 * @param hash - The long hash to format.
 * @param chars - The number of characters to take from both the start and end (default: 1).
 * @param separator - The string to place between the start and end characters (default: "...").
 * @returns The formatted hash string.
 */
export function formatId (
  hash: string,
  chars = 3,
  separator = '...'
): string {
  if (!hash || hash.length <= chars * 2) {
    return hash // Return the hash as is if it's too short to format
  }

  const start = hash.slice(0, chars) // Extract the starting characters
  const end = hash.slice(-chars) // Extract the ending characters

  return `${start}${separator}${end}`
}

/**
 * Formats token amounts by automatically determining the most appropriate unit
 * (`TST`, `gTSTWei`, or `TSTWei`) for human readability, using `bigint` for precision.
 * @param amount - The token amount in `wei` (as a string, number, or bigint).
 * @returns The formatted token amount string.
 */
export function formatTokenAmount(amount: bigint | number | string): string {
  const decimals = 10n ** 18n; // 10^18 for TST
  const gWeiFactor = 10n ** 9n; // 10^9 for gTSTWei

  let numericAmount: bigint;

  // Convert input to bigint
  if (typeof amount === "string") {
    numericAmount = BigInt(amount);
  } else if (typeof amount === "number") {
    numericAmount = BigInt(Math.floor(amount)); // Convert to an integer first
  } else {
    numericAmount = amount;
  }

  // If the amount is greater than or equal to 1 TST (10^18 wei), format in TST
  if (numericAmount >= decimals) {
    const wholeUnits = (numericAmount * 100n) / decimals; // Multiply by 100 to handle decimals
    return (
      `${Number(wholeUnits / 100n).toLocaleString()}` +
      `.${String(wholeUnits % 100n).padStart(2, "0")} TST`
    );
  }

  // If the amount is greater than or equal to 1 gTSTWei (10^9 wei), format in gTSTWei
  if (numericAmount >= gWeiFactor) {
    const wholeUnits = (numericAmount * 100n) / gWeiFactor; // Multiply by 100 to handle decimals
    return (
      `${Number(wholeUnits / 100n).toLocaleString()}` +
      `.${String(wholeUnits % 100n).padStart(2, "0")} gTSTWei`
    );
  }

  // Otherwise, format as TSTWei (smallest unit)
  return `${numericAmount.toLocaleString()} TSTWei`;
}
