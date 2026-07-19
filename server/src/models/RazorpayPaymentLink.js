import mongoose from 'mongoose';

const LINK_STATUSES = ['created', 'paid', 'expired', 'cancelled', 'partially_paid'];
const PAYMENT_ATTEMPT_STATUSES = ['', 'failed', 'captured'];

const razorpayPaymentLinkSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    razorpayLinkId: { type: String, required: true, unique: true },
    shortUrl: { type: String, default: '' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    description: { type: String, default: '' },
    customerName: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    customerContact: { type: String, default: '' },
    paymentType: { type: String, enum: ['new', 'renewal', 'other'], default: 'other' },
    status: { type: String, enum: LINK_STATUSES, default: 'created' },
    statusUpdatedAt: { type: Date, default: null },
    lastWebhookEvent: { type: String, default: '' },
    lastPaymentStatus: { type: String, enum: PAYMENT_ATTEMPT_STATUSES, default: '' },
    lastPaymentId: { type: String, default: '' },
    lastPaymentAttemptAt: { type: Date, default: null },
    failureCode: { type: String, default: '' },
    failureDescription: { type: String, default: '' },
    expireBy: { type: Date, default: null },
    notifyEmail: { type: Boolean, default: true },
    notifySms: { type: Boolean, default: true },
    paymentRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentRecord', default: null },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    subscriptionScheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionSchedule',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

razorpayPaymentLinkSchema.index({ companyId: 1, status: 1 });

export default mongoose.model('RazorpayPaymentLink', razorpayPaymentLinkSchema);
export { LINK_STATUSES };
