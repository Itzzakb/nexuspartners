import mongoose from 'mongoose';

const employeeSalarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    monthlySalary: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    effectiveFrom: { type: Date, default: null },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

employeeSalarySchema.index({ companyId: 1, userId: 1 });

export default mongoose.model('EmployeeSalary', employeeSalarySchema);
