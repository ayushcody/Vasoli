/**
 * UPI Pay Integration — India-first payment initiation.
 *
 * This module builds UPI payment intents via:
 * 1. Google Pay for India PaymentRequest API (web)
 * 2. UPI deep link fallback (mobile)
 * 3. QR code generation (desktop — uses qrcode.react in the component)
 *
 * IMPORTANT: This is payment INITIATION only, not bank history syncing.
 */

export interface UpiPaymentIntent {
    pa: string;       // Payee VPA (e.g., merchant@upi)
    pn: string;       // Payee name
    am: string;       // Amount
    cu?: string;      // Currency (default INR)
    tr?: string;      // Transaction reference (unique)
    tn?: string;      // Transaction note
    mc?: string;      // Merchant category code
}

/** Build a `upi://pay?...` URI */
export function buildUpiDeepLink(intent: UpiPaymentIntent): string {
    const params = new URLSearchParams({
        pa: intent.pa,
        pn: intent.pn,
        am: intent.am,
        cu: intent.cu || "INR",
    });
    if (intent.tr) params.set("tr", intent.tr);
    if (intent.tn) params.set("tn", intent.tn);
    if (intent.mc) params.set("mc", intent.mc);

    return `upi://pay?${params.toString()}`;
}

/** Generate a unique transaction reference */
export function generateTxnRef(): string {
    return `VASOLI${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Attempt Google Pay for India PaymentRequest.
 * Returns true if user completed payment, false if cancelled.
 * Falls back gracefully if not supported.
 */
export async function initiateGooglePayIndia(
    intent: UpiPaymentIntent
): Promise<{ success: boolean; error?: string }> {
    if (typeof window === "undefined" || !("PaymentRequest" in window)) {
        return { success: false, error: "PaymentRequest not supported" };
    }

    try {
        const supportedMethods = [
            {
                supportedMethods: "https://tez.google.com/pay",
                data: {
                    pa: intent.pa,
                    pn: intent.pn,
                    tr: intent.tr || generateTxnRef(),
                    am: intent.am,
                    cu: intent.cu || "INR",
                    tn: intent.tn || "Payment via Vasoli",
                    mc: intent.mc || "0000",
                },
            },
        ];

        const details = {
            total: {
                label: intent.pn,
                amount: { currency: intent.cu || "INR", value: intent.am },
            },
        };

        const request = new PaymentRequest(supportedMethods, details);
        const canMake = await request.canMakePayment();

        if (!canMake) {
            return { success: false, error: "Google Pay not available" };
        }

        const response = await request.show();
        await response.complete("success");
        return { success: true };
    } catch (e: any) {
        if (e.name === "AbortError") {
            return { success: false, error: "Payment cancelled" };
        }
        return { success: false, error: e.message };
    }
}

/** Check if we're on mobile for UPI deep link support */
export function isMobile(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
