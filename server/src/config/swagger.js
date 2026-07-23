import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';

const __dirname = dirname(fileURLToPath(import.meta.url));

function withDynamicServers(spec, { absolutePath, relativePath, absoluteDescription, relativeDescription }) {
  const copy = JSON.parse(JSON.stringify(spec));
  const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
  copy.servers = [
    {
      url: `${serverUrl.replace(/\/$/, '')}${absolutePath}`,
      description: absoluteDescription,
    },
    {
      url: relativePath,
      description: relativeDescription,
    },
  ];
  return copy;
}

function loadJsonSpec(filename) {
  const raw = readFileSync(join(__dirname, '../docs', filename), 'utf8');
  return JSON.parse(raw);
}

export function loadPlatformSpec() {
  return withDynamicServers(loadJsonSpec('platform.openapi.json'), {
    absolutePath: '/api',
    relativePath: '/api',
    absoluteDescription: 'Platform API (current environment)',
    relativeDescription: 'Relative base path (same host as Swagger UI)',
  });
}

export function loadRecruiterPortalSpec() {
  return withDynamicServers(loadJsonSpec('recruiterPortal.openapi.json'), {
    absolutePath: '/api/recruiter',
    relativePath: '/api/recruiter',
    absoluteDescription: 'Recruiter API (current environment)',
    relativeDescription: 'Relative base path (same host as Swagger UI)',
  });
}

const swaggerUiOptions = {
  persistAuthorization: true,
  displayRequestDuration: true,
  docExpansion: 'list',
  filter: true,
  tryItOutEnabled: true,
};

/** Platform Swagger UI — loads live spec from /api/docs/openapi.json */
export const platformSwaggerUi = swaggerUi.setup(null, {
  customSiteTitle: 'Nexus Partners — Platform API',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    ...swaggerUiOptions,
    url: '/api/docs/openapi.json',
  },
});

/** Recruiter Swagger UI — loads live spec from /api/docs/recruiter/openapi.json */
export const recruiterPortalSwaggerUi = swaggerUi.setup(null, {
  customSiteTitle: 'Nexus Partners — Recruiter API',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    ...swaggerUiOptions,
    url: '/api/docs/recruiter/openapi.json',
  },
});

export { swaggerUi };
