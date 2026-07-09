import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import { configureCloudinary } from './services/cloudinary.service.js';
import { configureSendGrid } from './services/sendgrid.service.js';
import { setIO } from './services/socket.service.js';
import { setupSocket } from './socket/index.js';
import authRoutes from './routes/auth.routes.js';
import companyRoutes from './routes/company.routes.js';
import userRoutes from './routes/user.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import resumeFormRoutes from './routes/resumeForm.routes.js';
import resumeFormViewRoutes from './routes/resumeFormView.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import placementRoutes from './routes/placement.routes.js';
import teamRoutes from './routes/team.routes.js';
import externalRoutes from './routes/external.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import salaryRoutes from './routes/salary.routes.js';
import billingRoutes from './routes/billing.routes.js';
import chatRoutes from './routes/chat.routes.js';
import permissionRoutes from './routes/permission.routes.js';
import studentRoutes from './routes/student.routes.js';
import resumeTemplateRoutes from './routes/resumeTemplate.routes.js';
import promptRoutes from './routes/prompt.routes.js';
import jobScrapRoutes from './routes/jobScrap.routes.js';
import recruiterPortalRoutes from './routes/recruiterPortal.routes.js';
import { swaggerUi, recruiterPortalSwaggerUi, recruiterPortalSpec } from './config/swagger.js';
import { handleRazorpayWebhook } from './controllers/webhook.controller.js';
import { initJobScrapScheduler } from './services/jobScrap.scheduler.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

configureCloudinary();
configureSendGrid();

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

setIO(io);
setupSocket(io);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.post(
  '/api/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/docs/recruiter/openapi.json', (_req, res) => {
  res.json(recruiterPortalSpec);
});

app.use(
  '/api/docs/recruiter',
  swaggerUi.serve,
  recruiterPortalSwaggerUi
);

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/resume-form', resumeFormRoutes);
app.use('/api/resume-form-view', resumeFormViewRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/placements', placementRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/resume-templates', resumeTemplateRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/job-scrap', jobScrapRoutes);
app.use('/api/recruiter', recruiterPortalRoutes);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await connectDB();
  await initJobScrapScheduler();
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
