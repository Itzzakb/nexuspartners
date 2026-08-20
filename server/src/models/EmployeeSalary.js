import mongoose from 'mongoose';

const EMPLOYEE_TYPES = ['user', 'recruiter'];

const employeeSalarySchema = new mongoose.Schema(
  {
    employeeType: { type: String, enum: EMPLOYEE_TYPES, default: 'user' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecruiterAccount', default: null },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    monthlySalary: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    effectiveFrom: { type: Date, default: null },
    /** Paid leave days allowed per month before salary deduction */
    allowedLeaves: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['active', 'discontinued'], default: 'active' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

employeeSalarySchema.index(
  { companyId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      userId: { $type: 'objectId' },
      $or: [{ employeeType: 'user' }, { employeeType: { $exists: false } }],
    },
  }
);
employeeSalarySchema.index(
  { companyId: 1, recruiterId: 1 },
  {
    unique: true,
    partialFilterExpression: { employeeType: 'recruiter', recruiterId: { $type: 'objectId' } },
  }
);

export default mongoose.model('EmployeeSalary', employeeSalarySchema);
export { EMPLOYEE_TYPES as SALARY_EMPLOYEE_TYPES };
