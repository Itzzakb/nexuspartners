import mongoose from 'mongoose';

const BILLING_STATUSES = ['draft', 'finalized', 'invoiced'];

const billingRecordSchema = new mongoose.Schema(
  {
    billingNumber: { type: String, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    billingMonth: { type: String, required: true },
    studentName: { type: String, default: '' },
    studentPhone: { type: String, default: '' },
    studentId: { type: String, default: '' },
    activeDays: { type: Number, default: 0 },
    billRatePerDay: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: BILLING_STATUSES, default: 'draft' },
    excluded: { type: Boolean, default: false },
    excludedReason: { type: String, default: '' },
    invoiceNumber: { type: String, default: '' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    batchId: { type: String, default: '' },
  },
  { timestamps: true }
);

billingRecordSchema.index({ companyId: 1, billingMonth: 1 });
billingRecordSchema.index({ batchId: 1 });

export default mongoose.model('BillingRecord', billingRecordSchema);
export { BILLING_STATUSES };
