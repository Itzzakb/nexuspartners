import mongoose from 'mongoose';

const paymentWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, default: '' },
    razorpayLinkId: { type: String, default: '' },
    eventType: { type: String, default: '' },
    processed: { type: Boolean, default: true },
  },
  { timestamps: true }
);

paymentWebhookEventSchema.index({ razorpayPaymentId: 1 }, { sparse: true });

export default mongoose.model('PaymentWebhookEvent', paymentWebhookEventSchema);
