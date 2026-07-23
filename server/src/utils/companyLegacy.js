import Company from '../models/Company.js';
import User from '../models/User.js';
import Ticket from '../models/Ticket.js';
import Interview from '../models/Interview.js';
import JobPlacement from '../models/JobPlacement.js';
import Team from '../models/Team.js';
import PaymentRecord from '../models/PaymentRecord.js';
import RazorpayPaymentLink from '../models/RazorpayPaymentLink.js';
import SubscriptionSchedule from '../models/SubscriptionSchedule.js';
import EmployeeSalary from '../models/EmployeeSalary.js';
import EmployeeLeave from '../models/EmployeeLeave.js';
import BillingRecord from '../models/BillingRecord.js';
import PermissionTemplate from '../models/PermissionTemplate.js';
import ResumeTemplate from '../models/ResumeTemplate.js';
import StudentNote from '../models/StudentNote.js';
import Student from '../models/Student.js';
import Conversation from '../models/Conversation.js';

const COMPANY_SCOPED_MODELS = [
  Ticket,
  Interview,
  JobPlacement,
  Team,
  PaymentRecord,
  RazorpayPaymentLink,
  SubscriptionSchedule,
  EmployeeSalary,
  EmployeeLeave,
  BillingRecord,
  PermissionTemplate,
  ResumeTemplate,
  StudentNote,
  Student,
  Conversation,
];

export function isLegacyFutureFluxCompany(company) {
  if (!company) return false;
  const slug = (company.slug || '').toLowerCase();
  const name = (company.name || '').toLowerCase();
  const api = (company.apiCompanyName || '').toLowerCase();

  if (slug === 'nexuspartners' || name.includes('nexuspartners')) {
    return false;
  }

  return (
    slug.includes('futureflux') ||
    name.includes('futureflux') ||
    api.includes('futureflux')
  );
}

export function legacyFutureFluxQuery() {
  return {
    $or: [
      { slug: /futureflux/i },
      { name: /futureflux/i },
      { apiCompanyName: /futureflux/i },
    ],
  };
}

export function visibleCompaniesQuery() {
  return {
    $nor: [
      { slug: /futureflux/i },
      { name: /futureflux/i },
      { apiCompanyName: /futureflux/i },
    ],
  };
}

export async function migrateFutureFluxToNexusPartners() {
  const nexus = await Company.findOne({ slug: 'nexuspartners' });
  if (!nexus) {
    return { migratedUsers: 0, migratedRecords: 0, removedCompanies: 0 };
  }

  const legacyCompanies = await Company.find({
    ...legacyFutureFluxQuery(),
    _id: { $ne: nexus._id },
  });

  let migratedUsers = 0;
  let migratedRecords = 0;

  for (const legacy of legacyCompanies) {
    const userResult = await User.updateMany(
      { companyId: legacy._id },
      { $set: { companyId: nexus._id } }
    );
    migratedUsers += userResult.modifiedCount;

    for (const Model of COMPANY_SCOPED_MODELS) {
      const result = await Model.updateMany(
        { companyId: legacy._id },
        { $set: { companyId: nexus._id } }
      );
      migratedRecords += result.modifiedCount;
    }

    await Company.deleteOne({ _id: legacy._id });
  }

  return {
    migratedUsers,
    migratedRecords,
    removedCompanies: legacyCompanies.length,
  };
}
