/**
 * Generates platform.openapi.json from a compact route catalog.
 * Run: node src/docs/generatePlatformOpenapi.js
 */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const bearer = [{ BearerAuth: [] }];
const apiSecret = [{ ApiSecretAuth: [] }];

/** @type {Array<{tag: string, method: string, path: string, summary: string, security?: object[]|null, params?: object[], body?: object, description?: string}>} */
const routes = [
  // System
  { tag: 'System', method: 'get', path: '/health', summary: 'Health check', security: null },
  {
    tag: 'System',
    method: 'post',
    path: '/webhooks/razorpay',
    summary: 'Razorpay payment webhook',
    security: null,
    description: 'Raw JSON body. Verified via Razorpay signature header.',
  },

  // Auth
  { tag: 'Auth', method: 'post', path: '/auth/register', summary: 'Register user', security: null, body: { username: 'string', password: 'string', name: 'string', email: 'string' } },
  { tag: 'Auth', method: 'post', path: '/auth/login', summary: 'Login', security: null, body: { username: 'string', password: 'string', companySlug: 'string?' } },
  { tag: 'Auth', method: 'post', path: '/auth/logout', summary: 'Logout', security: null },
  { tag: 'Auth', method: 'post', path: '/auth/refresh', summary: 'Refresh access token', security: null, body: { refreshToken: 'string' } },
  { tag: 'Auth', method: 'post', path: '/auth/forgot-password', summary: 'Request password reset', security: null, body: { email: 'string' } },
  { tag: 'Auth', method: 'post', path: '/auth/reset-password', summary: 'Reset password', security: null, body: { token: 'string', password: 'string' } },
  { tag: 'Auth', method: 'get', path: '/auth/me', summary: 'Current authenticated user' },

  // Companies
  { tag: 'Companies', method: 'get', path: '/companies/public', summary: 'List public companies', security: null },
  { tag: 'Companies', method: 'get', path: '/companies/me', summary: 'Get own company settings' },
  { tag: 'Companies', method: 'patch', path: '/companies/me', summary: 'Update own company settings (company admin)', body: true },
  { tag: 'Companies', method: 'get', path: '/companies', summary: 'List all companies (platform admin)' },
  { tag: 'Companies', method: 'post', path: '/companies', summary: 'Create company (platform admin)', body: true },
  { tag: 'Companies', method: 'get', path: '/companies/{id}', summary: 'Get company by id', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Companies', method: 'patch', path: '/companies/{id}', summary: 'Update company (company admin)', params: [{ name: 'id', in: 'path', required: true }], body: true },

  // Users
  { tag: 'Users', method: 'get', path: '/users', summary: 'List users (company admin)' },
  { tag: 'Users', method: 'post', path: '/users', summary: 'Create user (company admin)', body: true },
  { tag: 'Users', method: 'patch', path: '/users/{id}', summary: 'Update user (company admin)', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Users', method: 'post', path: '/users/{id}/send-reset', summary: 'Send password reset email', params: [{ name: 'id', in: 'path', required: true }] },

  // Upload
  {
    tag: 'Upload',
    method: 'post',
    path: '/upload',
    summary: 'Upload file',
    description: 'multipart/form-data file upload',
  },

  // Tickets
  {
    tag: 'Tickets',
    method: 'post',
    path: '/tickets/external',
    summary: 'Create ticket via external API',
    security: apiSecret,
    description: 'Requires x-api-secret header (no JWT).',
    body: true,
  },
  { tag: 'Tickets', method: 'get', path: '/tickets/stats', summary: 'Ticket statistics' },
  { tag: 'Tickets', method: 'get', path: '/tickets/dashboard', summary: 'Ticket dashboard aggregates' },
  { tag: 'Tickets', method: 'get', path: '/tickets/resume-team', summary: 'Resume team members' },
  {
    tag: 'Tickets',
    method: 'get',
    path: '/tickets',
    summary: 'List tickets',
    params: [
      { name: 'page', in: 'query' },
      { name: 'limit', in: 'query' },
      { name: 'stage', in: 'query' },
      { name: 'q', in: 'query' },
    ],
  },
  { tag: 'Tickets', method: 'post', path: '/tickets', summary: 'Create ticket', body: true },
  { tag: 'Tickets', method: 'get', path: '/tickets/{id}', summary: 'Get ticket', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Tickets', method: 'patch', path: '/tickets/{id}', summary: 'Update ticket', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Tickets', method: 'post', path: '/tickets/{id}/enable-form-edit', summary: 'Enable form edit', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Tickets', method: 'post', path: '/tickets/{id}/sync-student-resume', summary: 'Sync student resume from form', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Tickets', method: 'post', path: '/tickets/{id}/form-share-link', summary: 'Get form share link', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Tickets', method: 'post', path: '/tickets/{id}/stage', summary: 'Change ticket stage', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Tickets', method: 'post', path: '/tickets/{id}/assign', summary: 'Assign ticket', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Tickets', method: 'post', path: '/tickets/{id}/assign-recruiter', summary: 'Assign recruiter to ticket', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Tickets', method: 'post', path: '/tickets/{id}/notes', summary: 'Add note', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Tickets', method: 'post', path: '/tickets/{id}/files', summary: 'Add resume file', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Tickets', method: 'delete', path: '/tickets/{id}', summary: 'Delete ticket', params: [{ name: 'id', in: 'path', required: true }] },

  // Resume form (public)
  { tag: 'Resume Form', method: 'get', path: '/resume-form/{ticketId}', summary: 'Load public resume form', security: null, params: [{ name: 'ticketId', in: 'path', required: true }] },
  { tag: 'Resume Form', method: 'put', path: '/resume-form/{ticketId}', summary: 'Save public resume form', security: null, params: [{ name: 'ticketId', in: 'path', required: true }], body: true },
  { tag: 'Resume Form', method: 'get', path: '/resume-form-view/{token}', summary: 'Shared form view by token', security: null, params: [{ name: 'token', in: 'path', required: true }] },

  // Resume
  { tag: 'Resume', method: 'get', path: '/resume/download/{token}', summary: 'Download resume by token', security: null, params: [{ name: 'token', in: 'path', required: true }] },
  { tag: 'Resume', method: 'post', path: '/resume/parse', summary: 'Parse resume', body: true },
  { tag: 'Resume', method: 'post', path: '/resume/build-download', summary: 'Build and download resume', body: true },
  { tag: 'Resume', method: 'post', path: '/resume/update-student', summary: 'Update student resume', body: true },

  // Interviews
  { tag: 'Interviews', method: 'get', path: '/interviews/share/{token}', summary: 'Shared interview view', security: null, params: [{ name: 'token', in: 'path', required: true }] },
  { tag: 'Interviews', method: 'get', path: '/interviews/stats', summary: 'Interview statistics' },
  { tag: 'Interviews', method: 'get', path: '/interviews', summary: 'List interviews', params: [{ name: 'page', in: 'query' }, { name: 'limit', in: 'query' }, { name: 'status', in: 'query' }, { name: 'q', in: 'query' }] },
  { tag: 'Interviews', method: 'post', path: '/interviews', summary: 'Create interview', body: true },
  { tag: 'Interviews', method: 'post', path: '/interviews/bulk', summary: 'Bulk interview action', body: true },
  { tag: 'Interviews', method: 'get', path: '/interviews/{id}', summary: 'Get interview', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Interviews', method: 'patch', path: '/interviews/{id}', summary: 'Update interview', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Interviews', method: 'delete', path: '/interviews/{id}', summary: 'Delete interview', params: [{ name: 'id', in: 'path', required: true }] },

  // Placements
  { tag: 'Placements', method: 'get', path: '/placements', summary: 'List placements' },
  { tag: 'Placements', method: 'post', path: '/placements', summary: 'Create placement', body: true },
  { tag: 'Placements', method: 'get', path: '/placements/{id}', summary: 'Get placement', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Placements', method: 'patch', path: '/placements/{id}', summary: 'Update placement', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Placements', method: 'delete', path: '/placements/{id}', summary: 'Delete placement', params: [{ name: 'id', in: 'path', required: true }] },

  // Teams
  { tag: 'Teams', method: 'get', path: '/teams/my', summary: 'Get current user team' },
  { tag: 'Teams', method: 'get', path: '/teams/users', summary: 'Search company users', params: [{ name: 'q', in: 'query' }] },
  { tag: 'Teams', method: 'get', path: '/teams', summary: 'List teams' },
  { tag: 'Teams', method: 'post', path: '/teams', summary: 'Create team', body: true },
  { tag: 'Teams', method: 'get', path: '/teams/{id}', summary: 'Get team', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Teams', method: 'patch', path: '/teams/{id}', summary: 'Update team', params: [{ name: 'id', in: 'path', required: true }], body: true },
  {
    tag: 'Teams',
    method: 'get',
    path: '/teams/{id}/members/{username}/students',
    summary: 'List students for team member',
    params: [
      { name: 'id', in: 'path', required: true },
      { name: 'username', in: 'path', required: true },
    ],
  },

  // External
  { tag: 'External', method: 'post', path: '/external/students', summary: 'Proxy: list/fetch students', body: true },
  { tag: 'External', method: 'post', path: '/external/student-details', summary: 'Proxy: student details', body: true },
  { tag: 'External', method: 'get', path: '/external/job-roles', summary: 'Proxy: job roles' },
  { tag: 'External', method: 'post', path: '/external/recruiters', summary: 'Proxy: company members/recruiters', body: true },
  { tag: 'External', method: 'post', path: '/external/recruiters/create', summary: 'Create recruiter account', body: true },
  { tag: 'External', method: 'post', path: '/external/recruiters/update', summary: 'Update recruiter account', body: true },

  // Payments
  { tag: 'Payments', method: 'post', path: '/payments/mock/{mockId}/pay', summary: 'Simulate mock payment', params: [{ name: 'mockId', in: 'path', required: true }] },
  { tag: 'Payments', method: 'get', path: '/payments/stats', summary: 'Payment statistics' },
  { tag: 'Payments', method: 'get', path: '/payments', summary: 'List payments', params: [{ name: 'page', in: 'query' }, { name: 'limit', in: 'query' }] },
  { tag: 'Payments', method: 'post', path: '/payments/manual', summary: 'Create manual payment', body: true },
  { tag: 'Payments', method: 'get', path: '/payments/links', summary: 'List payment links' },
  { tag: 'Payments', method: 'post', path: '/payments/razorpay/link', summary: 'Create Razorpay payment link', body: true },
  { tag: 'Payments', method: 'get', path: '/payments/links/{id}', summary: 'Get payment link', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Payments', method: 'get', path: '/payments/subscriptions', summary: 'List subscriptions' },
  { tag: 'Payments', method: 'post', path: '/payments/subscriptions', summary: 'Create subscription', body: true },
  { tag: 'Payments', method: 'patch', path: '/payments/subscriptions/{id}', summary: 'Update subscription', params: [{ name: 'id', in: 'path', required: true }], body: true },

  // Salaries
  { tag: 'Salaries', method: 'post', path: '/salaries/verify-password', summary: 'Verify salaries module password', body: true },
  { tag: 'Salaries', method: 'get', path: '/salaries', summary: 'List salaries' },
  { tag: 'Salaries', method: 'post', path: '/salaries', summary: 'Upsert salary (requires salaries password)', body: true },
  { tag: 'Salaries', method: 'delete', path: '/salaries/{id}', summary: 'Delete salary (requires salaries password)', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Salaries', method: 'get', path: '/salaries/leaves', summary: 'List leaves' },
  { tag: 'Salaries', method: 'post', path: '/salaries/leaves', summary: 'Create leave', body: true },
  { tag: 'Salaries', method: 'patch', path: '/salaries/leaves/{id}', summary: 'Update leave', params: [{ name: 'id', in: 'path', required: true }], body: true },

  // Billing
  { tag: 'Billing', method: 'get', path: '/billing', summary: 'List billing records' },
  { tag: 'Billing', method: 'get', path: '/billing/preview', summary: 'Preview billing' },
  { tag: 'Billing', method: 'get', path: '/billing/batches', summary: 'List billing batches' },
  { tag: 'Billing', method: 'post', path: '/billing/generate', summary: 'Generate billing', body: true },
  { tag: 'Billing', method: 'patch', path: '/billing/{id}', summary: 'Update billing record', params: [{ name: 'id', in: 'path', required: true }], body: true },

  // Chat
  { tag: 'Chat', method: 'get', path: '/chat/conversations', summary: 'List conversations' },
  { tag: 'Chat', method: 'post', path: '/chat/conversations', summary: 'Start conversation', body: true },
  { tag: 'Chat', method: 'get', path: '/chat/users', summary: 'Search chat users', params: [{ name: 'q', in: 'query' }] },
  { tag: 'Chat', method: 'get', path: '/chat/conversations/{id}/messages', summary: 'Get messages', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Chat', method: 'post', path: '/chat/conversations/{id}/messages', summary: 'Send message', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Chat', method: 'post', path: '/chat/conversations/{id}/read', summary: 'Mark conversation read', params: [{ name: 'id', in: 'path', required: true }] },

  // Permissions
  { tag: 'Permissions', method: 'get', path: '/permissions/modules', summary: 'List module keys' },
  { tag: 'Permissions', method: 'get', path: '/permissions/templates', summary: 'List permission templates' },
  { tag: 'Permissions', method: 'post', path: '/permissions/templates', summary: 'Create permission template', body: true },
  { tag: 'Permissions', method: 'patch', path: '/permissions/templates/{id}', summary: 'Update permission template', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Permissions', method: 'delete', path: '/permissions/templates/{id}', summary: 'Delete permission template', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Permissions', method: 'patch', path: '/permissions/users/{id}', summary: 'Update user permissions', params: [{ name: 'id', in: 'path', required: true }], body: true },

  // Students
  { tag: 'Students', method: 'get', path: '/students', summary: 'List students' },
  { tag: 'Students', method: 'post', path: '/students', summary: 'Create student record', body: true },
  { tag: 'Students', method: 'get', path: '/students/lookup', summary: 'Lookup student by phone', params: [{ name: 'phone', in: 'query', required: true }] },
  { tag: 'Students', method: 'get', path: '/students/ticket/{ticketId}/profile', summary: 'Ticket student profile', params: [{ name: 'ticketId', in: 'path', required: true }] },
  { tag: 'Students', method: 'post', path: '/students/ticket/{ticketId}/create', summary: 'Create student from ticket', params: [{ name: 'ticketId', in: 'path', required: true }], body: true },
  { tag: 'Students', method: 'get', path: '/students/{phone}', summary: 'Get student by phone', params: [{ name: 'phone', in: 'path', required: true }] },
  { tag: 'Students', method: 'patch', path: '/students/{phone}/notes', summary: 'Update student notes', params: [{ name: 'phone', in: 'path', required: true }], body: true },

  // Resume templates
  { tag: 'Resume Templates', method: 'get', path: '/resume-templates', summary: 'List ATS resume templates' },
  { tag: 'Resume Templates', method: 'post', path: '/resume-templates', summary: 'Create resume template', body: true },
  { tag: 'Resume Templates', method: 'patch', path: '/resume-templates/{id}', summary: 'Update resume template', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Resume Templates', method: 'delete', path: '/resume-templates/{id}', summary: 'Delete resume template', params: [{ name: 'id', in: 'path', required: true }] },

  // Prompts
  { tag: 'Prompts', method: 'get', path: '/prompts', summary: 'List prompts (platform admin)' },
  { tag: 'Prompts', method: 'patch', path: '/prompts/{key}', summary: 'Update prompt by key (platform admin)', params: [{ name: 'key', in: 'path', required: true }], body: true },

  // Job scrap
  { tag: 'Job Scrap', method: 'get', path: '/job-scrap/stats', summary: 'Job scrap statistics' },
  { tag: 'Job Scrap', method: 'get', path: '/job-scrap/runs', summary: 'List sync runs' },
  { tag: 'Job Scrap', method: 'get', path: '/job-scrap/profiles', summary: 'List scrap profiles' },
  { tag: 'Job Scrap', method: 'post', path: '/job-scrap/profiles', summary: 'Create scrap profile', body: true },
  { tag: 'Job Scrap', method: 'patch', path: '/job-scrap/profiles/{id}', summary: 'Update scrap profile', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Job Scrap', method: 'delete', path: '/job-scrap/profiles/{id}', summary: 'Delete scrap profile', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Job Scrap', method: 'post', path: '/job-scrap/profiles/{id}/sync', summary: 'Sync one profile now', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Job Scrap', method: 'post', path: '/job-scrap/sync-all', summary: 'Sync all profiles now' },
  { tag: 'Job Scrap', method: 'get', path: '/job-scrap/jobs', summary: 'List scraped jobs', params: [{ name: 'page', in: 'query' }, { name: 'limit', in: 'query' }, { name: 'q', in: 'query' }] },
  { tag: 'Job Scrap', method: 'post', path: '/job-scrap/jobs', summary: 'Create manual job', body: true },
  { tag: 'Job Scrap', method: 'get', path: '/job-scrap/jobs/{id}', summary: 'Get scraped job', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Job Scrap', method: 'patch', path: '/job-scrap/jobs/{id}', summary: 'Update scraped job', params: [{ name: 'id', in: 'path', required: true }], body: true },
  { tag: 'Job Scrap', method: 'delete', path: '/job-scrap/jobs/{id}', summary: 'Delete scraped job', params: [{ name: 'id', in: 'path', required: true }] },
  { tag: 'Job Scrap', method: 'get', path: '/job-scrap/master', summary: 'List job scrap master items' },
];

const tagDescriptions = {
  System: 'Health and webhooks',
  Auth: 'Staff login, session, password reset',
  Companies: 'Company settings and platform company admin',
  Users: 'Company user management',
  Upload: 'File uploads',
  Tickets: 'Ticket pipeline and onboarding',
  'Resume Form': 'Public student resume form',
  Resume: 'Parse, build, and update resumes',
  Interviews: 'Interview tracking',
  Placements: 'Placement records',
  Teams: 'Teams and member students',
  External: 'Proxies to Nexus Partners student/recruiter APIs',
  Payments: 'Payments, links, subscriptions',
  Salaries: 'Salaries and leaves (module permission)',
  Billing: 'Billing generation (module permission)',
  Chat: 'Internal chat (module permission)',
  Permissions: 'Permission templates and user modules',
  Students: 'Local student records (module permission)',
  'Resume Templates': 'ATS resume templates (ats module)',
  Prompts: 'AI prompt configuration (platform admin)',
  'Job Scrap': 'Job scraping profiles and jobs (job_scrap module)',
};

function opId(method, path) {
  const cleaned = path
    .replace(/^\//, '')
    .replace(/\{([^}]+)\}/g, 'By$1')
    .replace(/[^a-zA-Z0-9]+/g, '_');
  return `${method}_${cleaned}`.replace(/_+/g, '_').replace(/_$/, '');
}

function buildParam(p) {
  return {
    name: p.name,
    in: p.in,
    required: !!p.required,
    schema: { type: 'string' },
    ...(p.description ? { description: p.description } : {}),
  };
}

function buildBody(body) {
  if (!body) return undefined;
  if (body === true) {
    return {
      required: true,
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: true },
        },
      },
    };
  }
  const properties = {};
  const required = [];
  for (const [key, type] of Object.entries(body)) {
    const optional = String(type).endsWith('?');
    const t = String(type).replace(/\?$/, '');
    properties[key] = { type: t === 'string' ? 'string' : t };
    if (!optional) required.push(key);
  }
  return {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties,
          ...(required.length ? { required } : {}),
        },
      },
    },
  };
}

const paths = {};
const tagsSeen = new Set();

for (const r of routes) {
  tagsSeen.add(r.tag);
  if (!paths[r.path]) paths[r.path] = {};
  const op = {
    tags: [r.tag],
    summary: r.summary,
    operationId: opId(r.method, r.path),
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true },
          },
        },
      },
      400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      500: { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
  };
  if (r.description) op.description = r.description;
  if (r.security === null) {
    op.security = [];
  } else if (r.security) {
    op.security = r.security;
  } else {
    op.security = bearer;
  }
  if (r.params?.length) op.parameters = r.params.map(buildParam);
  const body = buildBody(r.body);
  if (body) op.requestBody = body;
  if (r.path === '/upload' && r.method === 'post') {
    op.requestBody = {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              file: { type: 'string', format: 'binary' },
            },
          },
        },
      },
    };
  }
  paths[r.path][r.method] = op;
}

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Nexus Partners — Platform Admin API',
    description:
      'REST API for the Nexus Partners admin portal (staff users).\n\n## Authentication\n1. `POST /auth/login` → `accessToken`\n2. Send `Authorization: Bearer <accessToken>` on protected routes.\n\n## Related docs\n- **Recruiter portal API** (separate JWT): [/api/docs/recruiter](/api/docs/recruiter)\n- Raw OpenAPI JSON: [/api/docs/openapi.json](/api/docs/openapi.json)\n\n## Notes\n- Some modules require `requireModule` permissions (salaries, billing, chat, students, ats, job_scrap).\n- External ticket create uses `x-api-secret` instead of JWT.\n- Request/response bodies are documented at a catalog level; expand schemas as needed.',
    version: '1.0.0',
    contact: { name: 'Nexus Partners', url: 'https://nexuspartners.com' },
  },
  servers: [
    { url: '/api', description: 'Platform API base path' },
  ],
  tags: [...tagsSeen].map((name) => ({
    name,
    description: tagDescriptions[name] || name,
  })),
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Staff JWT from POST /auth/login',
      },
      ApiSecretAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-secret',
        description: 'Shared secret for external ticket creation',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
        },
      },
    },
  },
  paths,
};

const out = join(__dirname, 'platform.openapi.json');
writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
console.log(`Wrote ${out} (${Object.keys(paths).length} paths, ${routes.length} operations)`);
