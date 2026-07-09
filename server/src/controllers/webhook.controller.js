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
    const entity = payload.payload?.payment_link?.entity || payload.payload?.payment?.entity || {};

    const eventId = payload.event_id || `${event}:${entity.id || Date.now()}`;
    const isNew = await recordWebhookEvent(eventId, {
      razorpayPaymentId: entity.payment_id || entity.id || '',
      razorpayLinkId: entity.id || '',
      eventType: event,
    });

    if (!isNew) {
      return res.json({ success: true, duplicate: true });
    }

    const linkEvents = ['payment_link.paid', 'payment_link.partially_paid'];
    if (linkEvents.includes(event)) {
      const linkId = entity.id;
      const link = await RazorpayPaymentLink.findOne({ razorpayLinkId: linkId });
      if (link) {
        await markLinkPaid(link, {
          paymentId: entity.payment_id || entity.payments?.[0]?.payment_id,
          razorpay_payment_id: entity.payment_id,
        });
      }
    }

    if (event === 'payment.captured') {
      const paymentLinkId = entity.notes?.payment_link_id || entity.payment_link_id;
      if (paymentLinkId) {
        const link = await RazorpayPaymentLink.findOne({ razorpayLinkId: paymentLinkId });
        if (link) {
          await markLinkPaid(link, { paymentId: entity.id });
        }
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Razorpay webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
