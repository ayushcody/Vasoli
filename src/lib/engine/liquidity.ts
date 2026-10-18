/** Only recorded INR cash accounts fund a rupee forecast; investments and credit limits do not. */
export function getRecordedLiquidity(accounts: readonly { accountType: string; currency: string; balancePaise: bigint }[]) {
    const liquidTypes = new Set(["CASH", "SAVINGS", "CURRENT", "WALLET"]);
    const included = accounts.filter(account => liquidTypes.has(account.accountType.toUpperCase()) && account.currency.toUpperCase() === "INR");
    const paise = included.reduce((sum, account) => sum + account.balancePaise, BigInt(0));
    if (paise > BigInt(Number.MAX_SAFE_INTEGER) || paise < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error("Recorded balance exceeds the supported forecast range.");
    return { balance: Number(paise) / 100, accountCount: included.length };
}
