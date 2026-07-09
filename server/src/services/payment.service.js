import crypto from 'crypto';
import Counter from '../models/Counter.js';
import Company from '../models/Company.js';
import Ticket from '../models/Ticket.js';
import PaymentRecord from '../models/PaymentRecord.js';
import RazorpayPaymentLink from '../models/RazorpayPaymentLink.js';
import PaymentWebhookEvent from '../models/PaymentWebhookEvent.js';
import SubscriptionSchedule from '../models/SubscriptionSchedule.js';
import ExternalTicketRequest from '../models/ExternalTicketRequest.js';
import {
  generateTicketNumber,
  addTicketHistory,
  ticketToJSON,
  buildResumeFormLink,
} from './ticket.service.js';
import { emitTicketEvent } from './socket.service.js';

export async function generatePaymentNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'payment_number' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `PAY-${String(counter.seq).padStart(4, '0')}`;
}

export function getCompanyFilter(user, queryCompanyId) {
  if (user.isPlatformAdmin) {
    return queryCompanyId ? { companyId: queryCompanyId } : {};
  }
  return { companyId: user.companyId._id };
}

export function canAccessCompany(user, companyId) {
  if (user.isPlatformAdmin) return true;
  return companyId?.toString() === user.companyId._id.toString();
}

export function formatAmount(amount, currency = 'INR') {
  const value = amount / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function paymentRecordToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    paymentNumber: o.paymentNumber,
    studentName: o.studentName,
    studentPhone: o.studentPhone,
    studentEmail: o.studentEmail,
    amount: o.amount,
    currency: o.currency,
    amountFormatted: formatAmount(o.amount, o.currency),
    paymentMethod: o.paymentMethod,
    paymentType: o.paymentType,
    status: o.status,
    description: o.description,
    razorpayPaymentId: o.razorpayPaymentId,
    razorpayPaymentLinkId: o.razorpayPaymentLinkId,
    ticketId: o.ticketId?.toString?.() ?? o.ticketId,
    companyId: o.companyId?._id?.toString() ?? o.companyId?.toString(),
    companyLabel: o.companyId?.name ?? '',
    notes: o.notes,
    paidAt: o.paidAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function paymentLinkToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    razorpayLinkId: o.razorpayLinkId,
    shortUrl: o.shortUrl,
    amount: o.amount,
    currency: o.currency,
    amountFormatted: formatAmount(o.amount, o.currency),
    description: o.description,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerContact: o.customerContact,
    paymentType: o.paymentType,
    status: o.status,
    expireBy: o.expireBy,
    notifyEmail: o.notifyEmail,
    notifySms: o.notifySms,
    paymentRecordId: o.paymentRecordId?.toString?.() ?? o.paymentRecordId,
    ticketId: o.ticketId?.toString?.() ?? o.ticketId,
    companyId: o.companyId?._id?.toString() ?? o.companyId?.toString(),
    companyLabel: o.companyId?.name ?? '',
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function subscriptionToJSON(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    studentName: o.studentName,
    studentPhone: o.studentPhone,
    studentEmail: o.studentEmail,
    planName: o.planName,
    amount: o.amount,
    currency: o.currency,
    amountFormatted: o.amount ? formatAmount(o.amount, o.currency) : '',
    frequency: o.frequency,
    nextDueDate: o.nextDueDate,
    status: o.status,
    notes: o.notes,
    companyId: o.companyId?._id?.toString() ?? o.companyId?.toString(),
    companyLabel: o.companyId?.name ?? '',
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export async function createTicketFromPayment({ company, customer, paymentId, paymentType }) {
  if (paymentType !== 'new') return null;

  const slug = company.slug;
  if (slug !== 'nexuspartners') return null;

  const idempotencyKey = `payment:${paymentId}`;
  const existing = await ExternalTicketRequest.findOne({ idempotencyKey });
  if (existing) {
    return Ticket.findById(existing.ticketId);
  }

  const ticketNumber = await generateTicketNumber();
  const ticket = await Ticket.create({
    ticketNumber,
    ticketType: 'new_resume',
    candidateName: customer.name || 'Payment Customer',
    phone: customer.contact || '',
    email: customer.email || '',
    notes: `Auto-created from Razorpay payment ${paymentId}`,
    companyId: company._id,
    createdBy: null,
    createdByLabel: 'razorpay_webhook',
    currentStage: 'ticket_created',
  });

  await addTicketHistory(ticket._id, {
    action: 'created',
    stage: 'ticket_created',
    note: `Ticket auto-created from payment ${paymentId}`,
    performedBy: null,
    performedByLabel: 'razorpay_webhook',
  });

  await ExternalTicketRequest.create({
    idempotencyKey,
    ticketId: ticket._id,
    source: 'razorpay_payment',
  });

  const populated = await Ticket.findById(ticket._id).populate('companyId', 'name');
  const json = ticketToJSON(populated, {
    companyName: company.name,
    resumeFormLink: buildResumeFormLink(ticket._id),
  });
  emitTicketEvent(company._id.toString(), 'ticket:created', { ticket: json });

  return ticket;
}

export async function markLinkPaid(link, payload = {}) {
  if (link.status === 'paid') return link;

  const company = await Company.findById(link.companyId);
  const paymentId = payload.paymentId || payload.razorpay_payment_id || `mock_${Date.now()}`;

  const existingPayment = await PaymentRecord.findOne({ razorpayPaymentId: paymentId });
  if (existingPayment) {
    link.status = 'paid';
    link.paymentRecordId = existingPayment._id;
    await link.save();
    return link;
  }

  const paymentNumber = await generatePaymentNumber();
  const record = await PaymentRecord.create({
    paymentNumber,
    companyId: link.companyId,
    studentName: link.customerName,
    studentPhone: link.customerContact,
    studentEmail: link.customerEmail,
    amount: link.amount,
    currency: link.currency,
    paymentMethod: 'razorpay',
    paymentType: link.paymentType,
    status: 'paid',
    description: link.description,
    razorpayPaymentId: paymentId,
    razorpayPaymentLinkId: link.razorpayLinkId,
    paymentLinkRef: link._id,
    subscriptionScheduleId: link.subscriptionScheduleId,
    paidAt: new Date(),
  });

  link.status = 'paid';
  link.paymentRecordId = record._id;

  const ticket = await createTicketFromPayment({
    company,
    customer: {
      name: link.customerName,
      email: link.customerEmail,
      contact: link.customerContact,
    },
    paymentId,
    paymentType: link.paymentType,
  });

  if (ticket) {
    link.ticketId = ticket._id;
    record.ticketId = ticket._id;
    await record.save();
  }

  if (link.subscriptionScheduleId) {
    const schedule = await SubscriptionSchedule.findById(link.subscriptionScheduleId);
    if (schedule) {
      schedule.lastPaymentRecordId = record._id;
      const next = new Date();
      if (schedule.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (schedule.frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
      else if (schedule.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
      schedule.nextDueDate = next;
      await schedule.save();
    }
  }

  await link.save();
  return link;
}

export async function recordWebhookEvent(eventId, data = {}) {
  try {
    await PaymentWebhookEvent.create({
      eventId,
      razorpayPaymentId: data.razorpayPaymentId || '',
      razorpayLinkId: data.razorpayLinkId || '',
      eventType: data.eventType || '',
    });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}
