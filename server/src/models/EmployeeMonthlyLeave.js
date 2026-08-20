import mongoose from 'mongoose';

const EMPLOYEE_TYPES = ['user', 'recruiter'];

const employeeMonthlyLeaveSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    employeeType: { type: String, enum: EMPLOYEE_TYPES, default: 'user' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecruiterAccount', default: null },
    year: { type: Number, required: true },
    /** Calendar month 1–12 */
    month: { type: Number, required: true, min: 1, max: 12 },
    /** ISO date strings YYYY-MM-DD selected as leave days */
    leaveDates: { type: [String], default: [] },
    /** Optional override; null = use calculated expected */
    actualSalary: { type: Number, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

employeeMonthlyLeaveSchema.index(
  { companyId: 1, employeeType: 1, userId: 1, year: 1, month: 1 },
  {
    unique: true,
    partialFilterExpression: {
      employeeType: 'user',
      userId: { $type: 'objectId' },
    },
  }
);
employeeMonthlyLeaveSchema.index(
  { companyId: 1, employeeType: 1, recruiterId: 1, year: 1, month: 1 },
  {
    unique: true,
    partialFilterExpression: {
      employeeType: 'recruiter',
      recruiterId: { $type: 'objectId' },
    },
  }
);

export default mongoose.model('EmployeeMonthlyLeave', employeeMonthlyLeaveSchema);
