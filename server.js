const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const Razorpay = require("razorpay");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url);
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
console.log("Using Key ID:", process.env.RAZORPAY_KEY_ID || "Not found");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.get("/", (req, res) => {
  res.send("Smart Parking Razorpay Backend Running");
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

    console.log("Creating Razorpay order with:", options);

    const order = await razorpay.orders.create(options);

    console.log("Order created successfully:", order);

    return res.status(200).json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Create order error FULL:", error);
    console.error("Status code:", error?.statusCode);
    console.error("Message:", error?.message);
    console.error("Description:", error?.error?.description);
    console.error("Code:", error?.error?.code);
    console.error("Error object:", error?.error);

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
      console.log("Payment verified");
      return res.status(200).json({ verified: true });
    }

    return res.status(400).json({
      verified: false,
      error: "Invalid signature",
    });
  } catch (error) {
    console.error("Verify error:", error);

    return res.status(500).json({
      verified: false,
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});