import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRecruiterPortalSpec() {
  const raw = readFileSync(join(__dirname, '../docs/recruiterPortal.openapi.json'), 'utf8');
  const spec = JSON.parse(raw);

  const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
  spec.servers = [
    {
      url: `${serverUrl.replace(/\/$/, '')}/api/recruiter`,
      description: 'Recruiter API (current environment)',
    },
    {
      url: '/api/recruiter',
      description: 'Relative base path (same host as Swagger UI)',
    },
  ];

  return spec;
}

const recruiterPortalSpec = loadRecruiterPortalSpec();

export const recruiterPortalSwaggerUi = swaggerUi.setup(recruiterPortalSpec, {
  customSiteTitle: 'Nexus Partners — Recruiter API',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    tryItOutEnabled: true,
  },
});

export { swaggerUi, recruiterPortalSpec };
