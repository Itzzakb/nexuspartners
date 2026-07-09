import Company from '../models/Company.js';
import PaymentRecord from '../models/PaymentRecord.js';
import RazorpayPaymentLink from '../models/RazorpayPaymentLink.js';
import SubscriptionSchedule from '../models/SubscriptionSchedule.js';
import {
  getCompanyFilter,
  canAccessCompany,
  generatePaymentNumber,
  paymentRecordToJSON,
  paymentLinkToJSON,
  subscriptionToJSON,
} from '../services/payment.service.js';
import {
  getRazorpayCredentials,
  createRazorpayPaymentLink,
  buildRazorpayLinkPayload,
  isMockMode,
} from '../services/razorpay.service.js';

export async function listPayments(req, res) {
  try {
    const filter = { ...getCompanyFilter(req.user, req.query.companyId) };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;

    const items = await PaymentRecord.find(filter)
      .populate('companyId', 'name')
      .sort({ createdAt: -1 });

    return res.json({ payments: items.map(paymentRecordToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list payments' });
  }
}

export async function getPaymentStats(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    const items = await PaymentRecord.find(filter);

    const paid = items.filter((p) => p.status === 'paid');
    const pending = items.filter((p) => p.status === 'pending');

    return res.json({
      stats: {
        total: items.length,
        paid: paid.length,
        pending: pending.length,
        totalCollected: paid.reduce((sum, p) => sum + p.amount, 0),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get payment stats' });
  }
}

export async function createManualPayment(req, res) {
  try {
    const {
      studentName,
      studentPhone,
      studentEmail,
      amount,
      currency,
      paymentMethod,
      paymentType,
      description,
      notes,
      companyId,
    } = req.body;

    if (!studentName || amount == null) {
      return res.status(400).json({ error: 'Student name and amount are required' });
    }

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    const paymentNumber = await generatePaymentNumber();
    const record = await PaymentRecord.create({
      paymentNumber,
      companyId: company._id,
      studentName,
      studentPhone: studentPhone || '',
      studentEmail: studentEmail || '',
      amount: Math.round(amount),
      currency: currency || company.salaryCurrency || 'INR',
      paymentMethod: paymentMethod || 'cash',
      paymentType: paymentType || 'other',
      status: 'paid',
      description: description || '',
      notes: notes || '',
      paidAt: new Date(),
      createdBy: req.user._id,
    });

    const populated = await PaymentRecord.findById(record._id).populate('companyId', 'name');
    return res.status(201).json({ payment: paymentRecordToJSON(populated) });
  } catch (err) {
    console.error('Manual payment error:', err);
    return res.status(500).json({ error: 'Failed to record payment' });
  }
}

export async function listPaymentLinks(req, res) {
  try {
    const filter = { ...getCompanyFilter(req.user, req.query.companyId) };
    if (req.query.status) filter.status = req.query.status;

    const items = await RazorpayPaymentLink.find(filter)
      .populate('companyId', 'name')
      .sort({ createdAt: -1 });

    return res.json({ links: items.map(paymentLinkToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list payment links' });
  }
}

export async function getPaymentLink(req, res) {
  try {
    const item = await RazorpayPaymentLink.findById(req.params.id).populate('companyId', 'name');
    if (!item) return res.status(404).json({ error: 'Payment link not found' });
    if (!canAccessCompany(req.user, item.companyId._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json({ link: paymentLinkToJSON(item) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get payment link' });
  }
}

export async function createPaymentLink(req, res) {
  try {
    const {
      customerName,
      customerEmail,
      customerContact,
      amount,
      currency,
      description,
      paymentType,
      expireBy,
      notifyEmail,
      notifySms,
      companyId,
      subscriptionScheduleId,
      autoCreateTicket,
    } = req.body;

    if (!customerName || amount == null) {
      return res.status(400).json({ error: 'Customer name and amount are required' });
    }

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    const credentials = getRazorpayCredentials(company);
    const amountSmallest = Math.round(amount);

    const razorpayPayload = buildRazorpayLinkPayload({
      amount: amountSmallest,
      currency: currency || company.salaryCurrency || 'INR',
      description: description || `${company.name} payment`,
      customer: {
        name: customerName,
        email: customerEmail || '',
        contact: customerContact || '',
      },
      expireBy,
      notifyEmail,
      notifySms,
      referenceId: `ff_${Date.now()}`,
    });

    const razorpayResult = await createRazorpayPaymentLink(credentials, razorpayPayload);

    const link = await RazorpayPaymentLink.create({
      companyId: company._id,
      razorpayLinkId: razorpayResult.id,
      shortUrl: razorpayResult.short_url || '',
      amount: amountSmallest,
      currency: razorpayPayload.currency,
      description: razorpayPayload.description,
      customerName,
      customerEmail: customerEmail || '',
      customerContact: customerContact || '',
      paymentType: paymentType || 'other',
      status: razorpayResult.status || 'created',
      expireBy: expireBy ? new Date(expireBy) : null,
      notifyEmail: notifyEmail !== false,
      notifySms: notifySms !== false,
      subscriptionScheduleId: subscriptionScheduleId || null,
      createdBy: req.user._id,
    });

    const populated = await RazorpayPaymentLink.findById(link._id).populate('companyId', 'name');

    return res.status(201).json({
      link: paymentLinkToJSON(populated),
      mock: isMockMode(credentials),
      autoCreateTicket: autoCreateTicket !== false && company.slug === 'nexuspartners',
    });
  } catch (err) {
    console.error('Create payment link error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create payment link' });
  }
}

export async function listSubscriptions(req, res) {
  try {
    const filter = { ...getCompanyFilter(req.user, req.query.companyId) };
    if (req.query.status) filter.status = req.query.status;

    const items = await SubscriptionSchedule.find(filter)
      .populate('companyId', 'name')
      .sort({ nextDueDate: 1, createdAt: -1 });

    return res.json({ subscriptions: items.map(subscriptionToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list subscriptions' });
  }
}

export async function createSubscription(req, res) {
  try {
    const {
      studentName,
      studentPhone,
      studentEmail,
      planName,
      amount,
      currency,
      frequency,
      nextDueDate,
      notes,
      companyId,
    } = req.body;

    if (!studentName) return res.status(400).json({ error: 'Student name is required' });

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    const item = await SubscriptionSchedule.create({
      companyId: company._id,
      studentName,
      studentPhone: studentPhone || '',
      studentEmail: studentEmail || '',
      planName: planName || '',
      amount: amount ? Math.round(amount) : 0,
      currency: currency || company.salaryCurrency || 'INR',
      frequency: frequency || 'monthly',
      nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
      notes: notes || '',
      createdBy: req.user._id,
    });

    const populated = await SubscriptionSchedule.findById(item._id).populate('companyId', 'name');
    return res.status(201).json({ subscription: subscriptionToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create subscription' });
  }
}

export async function updateSubscription(req, res) {
  try {
    const item = await SubscriptionSchedule.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Subscription not found' });
    if (!canAccessCompany(req.user, item.companyId)) return res.status(403).json({ error: 'Access denied' });

    const fields = ['studentName', 'studentPhone', 'studentEmail', 'planName', 'amount', 'currency', 'frequency', 'status', 'notes'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    });
    if (req.body.nextDueDate !== undefined) {
      item.nextDueDate = req.body.nextDueDate ? new Date(req.body.nextDueDate) : null;
    }
    if (req.body.amount !== undefined) item.amount = Math.round(req.body.amount);

    await item.save();
    const populated = await SubscriptionSchedule.findById(item._id).populate('companyId', 'name');
    return res.json({ subscription: subscriptionToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update subscription' });
  }
}

export async function simulateMockPayment(req, res) {
  try {
    const { isMockMode } = await import('../services/razorpay.service.js');
    if (!isMockMode()) {
      return res.status(403).json({ error: 'Mock payments only available in development mode' });
    }

    const link = await RazorpayPaymentLink.findOne({ razorpayLinkId: req.params.mockId });
    if (!link) return res.status(404).json({ error: 'Mock payment link not found' });

    const { markLinkPaid } = await import('../services/payment.service.js');
    await markLinkPaid(link, { paymentId: `mock_pay_${Date.now()}` });

    const updated = await RazorpayPaymentLink.findById(link._id).populate('companyId', 'name');
    return res.json({
      success: true,
      message: 'Mock payment processed',
      link: paymentLinkToJSON(updated),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Mock payment failed' });
  }
}
