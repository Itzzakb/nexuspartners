export const VISA_OPTIONS = [
  'F-1 Visa',
  'F-1 OPT',
  'F-1 STEM OPT',
  'OPT EAD',
  'H-1B Visa',
  'H-4 EAD Visa',
  'GC (Green Card - Permanent Residency)',
  'GC EAD',
  'U.S. Citizenship',
];

export const WORK_EXPERIENCE_SECTOR_NOTE = `Please highlight your previous work experience across any 3 of the following sectors:

Technology & Software – Google, Microsoft, Apple
Healthcare & Pharmaceuticals – Pfizer, Johnson & Johnson, UnitedHealth Group
Banking & Financial Services – JPMorgan Chase, Bank of America, Goldman Sachs
Retail & E-commerce – Amazon, Walmart, Target
Manufacturing & Industrial – General Motors, Boeing, 3M
Energy (Oil, Gas, Renewables) – ExxonMobil, Chevron, NextEra Energy
Telecommunications – AT&T, Verizon, T-Mobile
Education & EdTech – Coursera, Chegg, Khan Academy
Transportation & Logistics – FedEx, UPS, Tesla
Media & Entertainment – Netflix, Disney, Warner Bros.`;

export function emptyWorkExperience() {
  return { client: '', startDate: '', endDate: '', role: '', clientAddress: '' };
}

export function emptyResumeFormData() {
  return {
    preferredName: '',
    dateOfBirth: '',
    linkedIn: '',
    resumeEmail: '',
    resumeEmailPassword: '',
    personalPhone: '',
    address: '',
    workExperience: [emptyWorkExperience()],
    mastersUniversity: '',
    mastersField: '',
    mastersGraduatedMonth: '',
    mastersGraduatedYear: '',
    bachelorsUniversity: '',
    bachelorsField: '',
    bachelorsGraduatedMonth: '',
    bachelorsGraduatedYear: '',
    visaStatus: '',
    dateOfArrivalUSA: '',
    certifications: '',
    preferredRole: '',
    consentAccurate: false,
    consentEmailAccess: false,
    legalName: '',
    signedDate: '',
  };
}

function hasValue(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

export function computeFormStatus(data, action = 'save') {
  if (!data) return 'unfilled';

  const fields = [
    data.preferredName,
    data.dateOfBirth,
    data.resumeEmail,
    data.personalPhone,
    data.address,
    data.visaStatus,
    data.preferredRole,
    data.legalName,
    data.signedDate,
  ];

  const hasAny = fields.some(hasValue) ||
    (data.workExperience || []).some((e) => hasValue(e.client) || hasValue(e.role)) ||
    hasValue(data.mastersUniversity) ||
    hasValue(data.bachelorsUniversity);

  if (!hasAny) return 'unfilled';

  const complete =
    hasValue(data.preferredName) &&
    hasValue(data.dateOfBirth) &&
    hasValue(data.resumeEmail) &&
    hasValue(data.personalPhone) &&
    hasValue(data.address) &&
    hasValue(data.visaStatus) &&
    hasValue(data.preferredRole) &&
    hasValue(data.legalName) &&
    hasValue(data.signedDate) &&
    data.consentAccurate === true &&
    data.consentEmailAccess === true &&
    (data.workExperience || []).some((e) => hasValue(e.client) && hasValue(e.role)) &&
    hasValue(data.mastersUniversity) &&
    hasValue(data.bachelorsUniversity);

  if (action === 'complete' && complete) return 'completed';
  if (complete) return 'completed';
  return 'partial';
}

export function formDataToRows(data) {
  if (!data) return [];
  const rows = [
    ['Preferred Name', data.preferredName],
    ['Date of Birth', data.dateOfBirth],
    ['LinkedIn', data.linkedIn],
    ['Resume Email', data.resumeEmail],
    ['Resume Email Password', data.resumeEmailPassword ? '••••••••' : ''],
    ['Personal Phone', data.personalPhone],
    ['Address', data.address],
    ['Visa Status', data.visaStatus],
    ['Date of Arrival (USA)', data.dateOfArrivalUSA],
    ['Certifications', data.certifications],
    ['Preferred Role', data.preferredRole],
    ['Masters University', data.mastersUniversity],
    ['Masters Field', data.mastersField],
    ['Masters Graduated', `${data.mastersGraduatedMonth || ''} ${data.mastersGraduatedYear || ''}`.trim()],
    ['Bachelors University', data.bachelorsUniversity],
    ['Bachelors Field', data.bachelorsField],
    ['Bachelors Graduated', `${data.bachelorsGraduatedMonth || ''} ${data.bachelorsGraduatedYear || ''}`.trim()],
    ['Legal Name', data.legalName],
    ['Signed Date', data.signedDate],
    ['Consent – Accurate Info', data.consentAccurate ? 'Yes' : 'No'],
    ['Consent – Email Access', data.consentEmailAccess ? 'Yes' : 'No'],
  ];

  (data.workExperience || []).forEach((exp, i) => {
    rows.push([`Experience ${i + 1} – Client`, exp.client]);
    rows.push([`Experience ${i + 1} – Role`, exp.role]);
    rows.push([`Experience ${i + 1} – Dates`, `${exp.startDate || ''} – ${exp.endDate || ''}`]);
    rows.push([`Experience ${i + 1} – Address`, exp.clientAddress]);
  });

  return rows.filter(([, v]) => hasValue(v));
}
