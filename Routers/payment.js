// Routers/payment.js
const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const requireLogin = require("../middleware/auth.js");
const User = require("../models/user.js");
const dotenv = require("dotenv");
dotenv.config();
const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
console.log("Razorpay ID:", process.env.RAZORPAY_KEY_ID); // Debug

// Create Razorpay order
router.post("/create-order", requireLogin, async (req, res) => {
  try {
    const options = {
      amount: 100, // INR 499 in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.error("Order creation failed:", err);
    res.status(500).send("Payment failed");
  }
});

// Verify payment
router.post("/verify", requireLogin, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).send("Invalid signature");
    }

    // Mark user as paid
    await User.updateOne(
      { email: req.session.user.email },
      { $set: { isPaid: true, plan: "pro" } }
    );

    res.send("Payment successful!");
  } catch (err) {
    console.error("Payment verification failed:", err);
    res.status(500).send("Verification failed");
  }
});

module.exports = router;
