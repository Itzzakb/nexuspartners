import RazorpayPaymentLink from '../models/RazorpayPaymentLink.js';
import { verifyWebhookSignature } from '../services/razorpay.service.js';
import { markLinkPaid, recordWebhookEvent } from '../services/payment.service.js';

export async function handleRazorpayWebhook(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body;

    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const event = payload.event;
    const linkEntity = payload.payload?.payment_link?.entity || {};
    const paymentEntity = payload.payload?.payment?.entity || {};
    const paymentId =
      paymentEntity.id ||
      linkEntity.payment_id ||
      linkEntity.payments?.[0]?.payment_id ||
      '';
    const linkId =
      linkEntity.id ||
      paymentEntity.payment_link_id ||
      paymentEntity.notes?.payment_link_id ||
      paymentEntity.notes?.razorpay_payment_link_id ||
      '';
    const eventAt = payload.created_at ? new Date(payload.created_at * 1000) : new Date();

    const eventId =
      payload.event_id ||
      `${event}:${linkId || paymentId || payload.created_at || Date.now()}`;
    const isNew = await recordWebhookEvent(eventId, {
      razorpayPaymentId: paymentId,
      razorpayLinkId: linkId,
      eventType: event,
      failureCode: paymentEntity.error_code || '',
      failureDescription: paymentEntity.error_description || '',
      eventOccurredAt: eventAt,
    });

    if (!isNew) {
      return res.json({ success: true, duplicate: true });
    }

    const link = linkId
      ? await RazorpayPaymentLink.findOne({ razorpayLinkId: linkId })
      : null;

    if (link) {
      link.lastWebhookEvent = event;

      if (event === 'payment_link.paid') {
        link.statusUpdatedAt = eventAt;
        link.lastPaymentStatus = 'captured';
        link.lastPaymentId = paymentId;
        link.lastPaymentAttemptAt = eventAt;
        link.failureCode = '';
        link.failureDescription = '';
        await markLinkPaid(link, { paymentId });
      } else if (event === 'payment_link.partially_paid') {
        link.statusUpdatedAt = eventAt;
        if (link.status !== 'paid') link.status = 'partially_paid';
        link.lastPaymentStatus = 'captured';
        link.lastPaymentId = paymentId;
        link.lastPaymentAttemptAt = eventAt;
        link.failureCode = '';
        link.failureDescription = '';
        await link.save();
      } else if (event === 'payment_link.cancelled') {
        link.statusUpdatedAt = eventAt;
        if (link.status !== 'paid') link.status = 'cancelled';
        await link.save();
      } else if (event === 'payment_link.expired') {
        link.statusUpdatedAt = eventAt;
        if (link.status !== 'paid') link.status = 'expired';
        await link.save();
      } else if (event === 'payment.failed') {
        // A failed attempt does not make the link itself failed; Razorpay may allow a retry.
        link.lastPaymentStatus = 'failed';
        link.lastPaymentId = paymentId;
        link.lastPaymentAttemptAt = eventAt;
        link.failureCode = paymentEntity.error_code || '';
        link.failureDescription = paymentEntity.error_description || 'Payment attempt failed';
        await link.save();
      } else if (event === 'payment.captured') {
        // payment_link.paid is authoritative for full payment and ticket creation.
        link.lastPaymentStatus = 'captured';
        link.lastPaymentId = paymentId;
        link.lastPaymentAttemptAt = eventAt;
        link.failureCode = '';
        link.failureDescription = '';
        await link.save();
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Razorpay webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
