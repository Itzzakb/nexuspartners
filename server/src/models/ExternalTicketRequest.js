import mongoose from 'mongoose';

const externalTicketRequestSchema = new mongoose.Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    source: { type: String, default: 'nexuspartnersus' },
  },
  { timestamps: true }
);

externalTicketRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model('ExternalTicketRequest', externalTicketRequestSchema);
