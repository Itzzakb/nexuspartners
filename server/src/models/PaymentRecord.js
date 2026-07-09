import mongoose from 'mongoose';

const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded', 'cancelled'];
const PAYMENT_METHODS = ['razorpay', 'cash', 'upi', 'bank_transfer', 'other'];
const PAYMENT_TYPES = ['new', 'renewal', 'other'];

const paymentRecordSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    studentName: { type: String, default: '' },
    studentPhone: { type: String, default: '' },
    studentEmail: { type: String, default: '' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'razorpay' },
    paymentType: { type: String, enum: PAYMENT_TYPES, default: 'other' },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    description: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpayPaymentLinkId: { type: String, default: '' },
    razorpayOrderId: { type: String, default: '' },
    paymentLinkRef: { type: mongoose.Schema.Types.ObjectId, ref: 'RazorpayPaymentLink', default: null },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    subscriptionScheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionSchedule',
      default: null,
    },
    notes: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

paymentRecordSchema.index({ companyId: 1, status: 1 });
paymentRecordSchema.index({ razorpayPaymentId: 1 }, { sparse: true });

export default mongoose.model('PaymentRecord', paymentRecordSchema);
export { PAYMENT_STATUSES, PAYMENT_METHODS, PAYMENT_TYPES };
