import mongoose from 'mongoose';

const ownerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  { _id: true }
);

const documentSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    type: { type: String, default: 'other' },
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
  },
  { _id: true }
);

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    logoUrl: { type: String, default: '' },
    logoPublicId: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },
    faviconPublicId: { type: String, default: '' },
    appTitle: { type: String, default: 'Nexus Partners Admin' },
    primaryColor: { type: String, default: '#3e6ae1' },
    secondaryColor: { type: String, default: '#7c3aed' },
    isPlatformAdmin: { type: Boolean, default: false },
    apiCompanyName: { type: String, default: '' },
    website: { type: String, default: '' },
    owners: [ownerSchema],
    documents: [documentSchema],
    razorpay: {
      enabled: { type: Boolean, default: false },
      keyId: { type: String, default: '' },
      keySecret: { type: String, default: '' },
    },
    zohoEnabled: { type: Boolean, default: false },
    skipBillingNames: { type: [String], default: [] },
    demoProfileIds: { type: [String], default: [] },
    paymentTypes: { type: [String], default: ['Cash', 'UPI', 'Bank Transfer'] },
    billRatePerDay: { type: Number, default: 4 },
    billingCurrency: { type: String, default: 'INR' },
    salaryCurrency: { type: String, default: 'INR' },
    createStudentPassword: { type: String, default: '' },
    visaTypes: { type: [String], default: ['F1', 'H1B', 'H4 EAD', 'Green Card', 'Citizen'] },
    additionalDetailFields: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Company', companySchema);
