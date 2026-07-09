import BillingRecord from '../models/BillingRecord.js';
import Company from '../models/Company.js';
import {
  buildBillingPreview,
  generateBillingNumber,
  getCompanyFilter,
  billingRecordToJSON,
} from '../services/billing.service.js';
import crypto from 'crypto';

export async function listBilling(req, res) {
  try {
    const filter = { ...getCompanyFilter(req.user, req.query.companyId) };
    if (req.query.billingMonth) filter.billingMonth = req.query.billingMonth;
    if (req.query.batchId) filter.batchId = req.query.batchId;

    const items = await BillingRecord.find(filter)
      .populate('companyId', 'name')
      .sort({ billingMonth: -1, studentName: 1 });

    return res.json({ records: items.map(billingRecordToJSON) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list billing records' });
  }
}

export async function previewBilling(req, res) {
  try {
    const { year, month, companyId } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required' });
    }

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const preview = await buildBillingPreview(
      targetCompanyId,
      Number(year),
      Number(month)
    );
    return res.json(preview);
  } catch (err) {
    console.error('Billing preview error:', err);
    return res.status(500).json({ error: err.message || 'Failed to preview billing' });
  }
}

export async function generateBilling(req, res) {
  try {
    const { year, month, companyId, finalize } = req.body;
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required' });
    }

    let targetCompanyId = req.user.companyId._id;
    if (req.user.isPlatformAdmin && companyId) targetCompanyId = companyId;

    const company = await Company.findById(targetCompanyId);
    if (!company) return res.status(400).json({ error: 'Invalid company' });

    const { summary, lines } = await buildBillingPreview(
      targetCompanyId,
      Number(year),
      Number(month)
    );

    const batchId = crypto.randomUUID();
    const status = finalize ? 'finalized' : 'draft';
    const records = [];

    for (const line of lines) {
      const billingNumber = await generateBillingNumber();
      const record = await BillingRecord.create({
        billingNumber,
        companyId: company._id,
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
        billingMonth: summary.billingMonth,
        studentName: line.studentName,
        studentPhone: line.studentPhone,
        studentId: line.studentId,
        activeDays: line.activeDays,
        billRatePerDay: line.billRatePerDay,
        totalAmount: line.totalAmount,
        currency: line.currency,
        status,
        excluded: line.excluded,
        excludedReason: line.excludedReason,
        generatedBy: req.user._id,
        batchId,
      });
      records.push(record);
    }

    const populated = await BillingRecord.find({ batchId }).populate('companyId', 'name');

    return res.status(201).json({
      batchId,
      summary,
      records: populated.map(billingRecordToJSON),
    });
  } catch (err) {
    console.error('Generate billing error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate billing' });
  }
}

export async function updateBillingRecord(req, res) {
  try {
    const item = await BillingRecord.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Billing record not found' });

    if (req.body.status) item.status = req.body.status;
    if (req.body.invoiceNumber !== undefined) item.invoiceNumber = req.body.invoiceNumber;

    await item.save();
    const populated = await BillingRecord.findById(item._id).populate('companyId', 'name');
    return res.json({ record: billingRecordToJSON(populated) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update billing record' });
  }
}

export async function getBillingBatches(req, res) {
  try {
    const filter = getCompanyFilter(req.user, req.query.companyId);
    const batches = await BillingRecord.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$batchId',
          billingMonth: { $first: '$billingMonth' },
          companyId: { $first: '$companyId' },
          totalAmount: { $sum: { $cond: ['$excluded', 0, '$totalAmount'] } },
          count: { $sum: 1 },
          createdAt: { $max: '$createdAt' },
          status: { $first: '$status' },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 50 },
    ]);
    return res.json({ batches });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list batches' });
  }
}
