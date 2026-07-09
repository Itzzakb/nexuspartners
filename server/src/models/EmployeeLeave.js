import mongoose from 'mongoose';

const LEAVE_STATUSES = ['pending', 'approved', 'rejected'];
const LEAVE_TYPES = ['casual', 'sick', 'unpaid', 'other'];

const employeeLeaveSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    leaveType: { type: String, enum: LEAVE_TYPES, default: 'casual' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, default: 1 },
    status: { type: String, enum: LEAVE_STATUSES, default: 'pending' },
    reason: { type: String, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

employeeLeaveSchema.index({ companyId: 1, userId: 1 });

export default mongoose.model('EmployeeLeave', employeeLeaveSchema);
export { LEAVE_STATUSES, LEAVE_TYPES };
