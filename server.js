const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const Razorpay = require("razorpay");
require("dotenv").config();

const app = express();

// Allow your hosted web app + localhost during testing
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:5173",
  "http://localhost:5500",
  "http://localhost:58643",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:58643",
  "https://smartpark-a9dac.web.app",
  "https://smartpark-a9dac.firebaseapp.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server tools / curl / postman with no origin
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS not allowed for origin: " + origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

// Important for browser preflight
app.options(/.*/, cors());

app.use(express.json());

app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url);
  console.log("Origin:", req.headers.origin || "no-origin");
  next();
});

console.log(
  "RAZORPAY_KEY_ID:",
  process.env.RAZORPAY_KEY_ID ? "Loaded" : "Missing"
);
console.log(
  "RAZORPAY_KEY_SECRET:",
  process.env.RAZORPAY_KEY_SECRET ? "Loaded" : "Missing"
);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Health checks
app.get("/", (req, res) => {
  res.status(200).send("Smart Parking Razorpay Backend Running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Backend healthy" });
});

app.post("/create-order", async (req, res) => {
  try {
    console.log("Incoming request body:", req.body);

    const { bookingId, amount, userId, slot } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        error: "bookingId and amount are required",
      });
    }

    const options = {
      amount: Number(amount) * 100,
      currency: "INR",
      receipt: `booking_${bookingId}`,
      notes: {
        bookingId: bookingId || "",
        userId: userId || "",
        slot: slot || "",
      },
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID, // keep this for web/mobile code
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Create order error FULL:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Unknown error",
      description: error?.error?.description || null,
      code: error?.error?.code || null,
    });
  }
});

app.post("/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Missing fields",
      });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      return res.status(200).json({
        success: true,
        verified: true,
      });
    }

    return res.status(400).json({
      success: false,
      verified: false,
      error: "Invalid signature",
    });
  } catch (error) {
    console.error("Verify error:", error);
    return res.status(500).json({
      success: false,
      verified: false,
      error: error.message,
    });
  }
});

// Helpful browser test route
app.get("/test-order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 2000,
      currency: "INR",
      receipt: "test_receipt_001",
    });

    res.status(200).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || "Test order failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});