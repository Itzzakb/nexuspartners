export interface WorkExperience {
  client: string;
  startDate: string;
  endDate: string;
  role: string;
  clientAddress: string;
}

export interface ResumeFormData {
  preferredName: string;
  dateOfBirth: string;
  linkedIn: string;
  resumeEmail: string;
  resumeEmailPassword: string;
  personalPhone: string;
  address: string;
  workExperience: WorkExperience[];
  mastersUniversity: string;
  mastersField: string;
  mastersGraduatedMonth: string;
  mastersGraduatedYear: string;
  bachelorsUniversity: string;
  bachelorsField: string;
  bachelorsGraduatedMonth: string;
  bachelorsGraduatedYear: string;
  visaStatus: string;
  dateOfArrivalUSA: string;
  certifications: string;
  preferredRole: string;
  consentAccurate: boolean;
  consentEmailAccess: boolean;
  legalName: string;
  signedDate: string;
}

export interface PublicFormResponse {
  ticketId: string;
  ticketNumber: string;
  candidateName: string;
  company: {
    name: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    appTitle: string;
  };
  formData: ResumeFormData;
  resumeFormStatus: 'unfilled' | 'partial' | 'completed';
  resumeFormEditEnabled: boolean;
  locked: boolean;
}

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

export function emptyWorkExperience(): WorkExperience {
  return { client: '', startDate: '', endDate: '', role: '', clientAddress: '' };
}

export function emptyResumeFormData(): ResumeFormData {
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

export const WORK_EXPERIENCE_NOTE = `Please highlight your previous work experience across any 3 of the following sectors:

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
