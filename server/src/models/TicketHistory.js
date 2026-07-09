import mongoose from 'mongoose';

const ticketHistorySchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    fromStage: { type: String, default: null },
    toStage: { type: String, required: true },
    note: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedByName: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ticketHistorySchema.index({ ticketId: 1, createdAt: -1 });

export default mongoose.model('TicketHistory', ticketHistorySchema);
