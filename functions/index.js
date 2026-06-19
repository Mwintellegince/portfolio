const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const crypto = require("crypto");

// Deploy functions to us-central1 (free tier region)
setGlobalOptions({ region: "us-central1" });

// ── Kashier credentials (server-side only — never exposed to client) ──────────
const KASHIER_MERCHANT_ID = "a0cc7581-83bf-4d25-a951-fb5966b94753";
const KASHIER_SECRET      = "cba7f91c8d48720ba600e64d1f3cdd86$74ebcf2aaa07a4eae5f3831c6c117da6bd0e443ebcd2c2a37acf9a9d2fdc21ad5028aa595ffeca28806b4f6ea5659c4f";

/**
 * kashierHash — HTTP Cloud Function
 *
 * Accepts POST body: { orderId, amount, currency }
 * Returns:          { hash, merchantId, mid, orderId, amount, currency, paymentUrl }
 *
 * The HMAC-SHA256 hash is computed server-side so the secret key is never
 * exposed in client-side JavaScript.
 */
exports.kashierHash = onRequest({ cors: true }, (req, res) => {
    // Allow preflight (OPTIONS) for CORS
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
    }

    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    const { orderId, amount, currency = "EGP" } = req.body;

    if (!orderId || !amount) {
        res.status(400).json({ error: "Missing required fields: orderId, amount" });
        return;
    }

    // Kashier hash string format:
    // ?payment_id={orderId}&amount={amount}&currency={currency}&merchantId={merchantId}
    const hashString = `?payment_id=${orderId}&amount=${Number(amount).toFixed(2)}&currency=${currency}&merchantId=${KASHIER_MERCHANT_ID}`;

    const hash = crypto
        .createHmac("sha256", KASHIER_SECRET)
        .update(hashString)
        .digest("hex");

    // Build the Kashier hosted payment URL
    const redirectUrl = encodeURIComponent("https://mwintellegince.github.io/portfolio/");
    const paymentUrl = [
        `https://checkout.kashier.io`,
        `?merchantId=${KASHIER_MERCHANT_ID}`,
        `&orderId=${orderId}`,
        `&amount=${Number(amount).toFixed(2)}`,
        `&currency=${currency}`,
        `&hash=${hash}`,
        `&merchantRedirect=${redirectUrl}`,
        `&mode=live`,
        `&metaData={}`,
        `&allowedMethods=card`,
        `&brandColor=%23b8860b`
    ].join("");

    res.set("Access-Control-Allow-Origin", "*");
    res.status(200).json({
        hash,
        merchantId: KASHIER_MERCHANT_ID,
        orderId,
        amount: Number(amount).toFixed(2),
        currency,
        paymentUrl
    });
});
