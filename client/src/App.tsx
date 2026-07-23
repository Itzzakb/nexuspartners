import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { CompanyProvider } from '@/context/CompanyContext';
import { TicketProvider } from '@/context/TicketContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from '@/components/ui/Toaster';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Settings from '@/pages/Settings';
import Users from '@/pages/Users';
import Companies from '@/pages/Companies';
import Tickets from '@/pages/Tickets';
import CreateTicket from '@/pages/CreateTicket';
import TicketDetail from '@/pages/TicketDetail';
import ResumeFormPublic from '@/pages/ResumeFormPublic';
import ResumeFormViewShare from '@/pages/ResumeFormViewShare';
import Interviews from '@/pages/Interviews';
import InterviewDetail from '@/pages/InterviewDetail';
import InterviewShare from '@/pages/InterviewShare';
import Placements from '@/pages/Placements';
import Teams from '@/pages/Teams';
import MyTeam from '@/pages/MyTeam';
import Recruiters, { RecruiterDetailPage, RecruiterEditPage } from '@/pages/Recruiters';
import Payments from '@/pages/Payments';
import PaymentLinks from '@/pages/PaymentLinks';
import Salaries from '@/pages/Salaries';
import GenerateBilling from '@/pages/GenerateBilling';
import UserAccess from '@/pages/UserAccess';
import Chat from '@/pages/Chat';
import Students from '@/pages/Students';
import StudentDetail from '@/pages/StudentDetail';
import TicketStudentProfile from '@/pages/TicketStudentProfile';
import SearchResume from '@/pages/SearchResume';
import AtsResumes from '@/pages/AtsResumes';
import PromptEditor from '@/pages/PromptEditor';
import JobScrap from '@/pages/JobScrap';
import { RecruiterAuthProvider } from '@/context/RecruiterAuthContext';
import { RecruiterProtectedRoute } from '@/components/recruiter/RecruiterProtectedRoute';
import { RecruiterLayout } from '@/components/recruiter/RecruiterLayout';
import RecruiterLogin from '@/pages/recruiter/RecruiterLogin';
import RecruiterApplications from '@/pages/recruiter/RecruiterApplications';
import RecruiterMyStudents from '@/pages/recruiter/RecruiterMyStudents';
import RecruiterStudentDetail from '@/pages/recruiter/RecruiterStudentDetail';
import RecruiterJobDetail from '@/pages/recruiter/RecruiterJobDetail';
import RecruiterResumeLibrary from '@/pages/recruiter/RecruiterResumeLibrary';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <TicketProvider>
            <Toaster />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/resume-form/:ticketId" element={<ResumeFormPublic />} />
              <Route path="/resume-form-view/:token" element={<ResumeFormViewShare />} />
              <Route path="/interview-share/:token" element={<InterviewShare />} />

              <Route
                path="/recruiter-portal/*"
                element={
                  <RecruiterAuthProvider>
                    <Routes>
                      <Route path="login" element={<RecruiterLogin />} />
                      <Route
                        element={
                          <RecruiterProtectedRoute>
                            <RecruiterLayout />
                          </RecruiterProtectedRoute>
                        }
                      >
                        <Route path="applications" element={<RecruiterApplications />} />
                        <Route path="students" element={<RecruiterMyStudents />} />
                        <Route path="students/:phone" element={<RecruiterStudentDetail />} />
                        <Route path="jobs/:id" element={<RecruiterJobDetail />} />
                        <Route path="resume-library" element={<RecruiterResumeLibrary />} />
                        <Route index element={<Navigate to="applications" replace />} />
                      </Route>
                    </Routes>
                  </RecruiterAuthProvider>
                }
              />

              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/create" element={<CreateTicket />} />
                <Route path="/ticket/:id" element={<TicketDetail />} />
                <Route path="/interviews" element={<Interviews />} />
                <Route path="/interviews/:id" element={<InterviewDetail />} />
                <Route path="/placements" element={<Placements />} />
                <Route path="/job-scrap" element={<JobScrap />} />
                <Route path="/teams" element={<Teams />} />
                <Route path="/my-team" element={<MyTeam />} />
                <Route path="/recruiters" element={<Recruiters />} />
                <Route path="/recruiters/:username/edit" element={<RecruiterEditPage />} />
                <Route path="/recruiters/:username" element={<RecruiterDetailPage />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/payment-links" element={<PaymentLinks />} />
                <Route path="/salaries" element={<Salaries />} />
                <Route path="/generate-billing" element={<GenerateBilling />} />
                <Route path="/user-access" element={<UserAccess />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/students" element={<Students />} />
                <Route path="/students/:phone" element={<StudentDetail />} />
                <Route path="/ticket/:ticketId/student-profile" element={<TicketStudentProfile />} />
                <Route path="/search-resume" element={<SearchResume />} />
                <Route path="/ats-resumes" element={<AtsResumes />} />
                <Route path="/prompt-editor" element={<PromptEditor />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/users" element={<Users />} />
                <Route path="/companies" element={<Companies />} />
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </TicketProvider>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
