import mongoose from 'mongoose';

const SCHEDULE_STATUSES = ['active', 'paused', 'cancelled', 'completed'];
const FREQUENCIES = ['monthly', 'quarterly', 'yearly', 'one_time'];

const subscriptionScheduleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    studentName: { type: String, required: true },
    studentPhone: { type: String, default: '' },
    studentEmail: { type: String, default: '' },
    planName: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    frequency: { type: String, enum: FREQUENCIES, default: 'monthly' },
    nextDueDate: { type: Date, default: null },
    status: { type: String, enum: SCHEDULE_STATUSES, default: 'active' },
    lastPaymentRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentRecord', default: null },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

subscriptionScheduleSchema.index({ companyId: 1, status: 1 });
subscriptionScheduleSchema.index({ studentPhone: 1 });

export default mongoose.model('SubscriptionSchedule', subscriptionScheduleSchema);
export { SCHEDULE_STATUSES, FREQUENCIES };
