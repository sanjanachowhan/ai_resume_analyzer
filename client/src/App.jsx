import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import { ProtectedRoute, GuestRoute } from './components/auth/RouteGuards.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ResumeUploadPage from './pages/ResumeUploadPage.jsx';
import JobDescriptionPage from './pages/JobDescriptionPage.jsx';
import AnalysisSetupPage from './pages/AnalysisSetupPage.jsx';
import AnalysisDashboardPage from './pages/AnalysisDashboardPage.jsx';
import AnalysisHistoryPage from './pages/AnalysisHistoryPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/resumes" element={<ResumeUploadPage />} />
          <Route path="/jobs" element={<JobDescriptionPage />} />
          <Route path="/analysis" element={<AnalysisSetupPage />} />
          <Route path="/analysis/:id" element={<AnalysisDashboardPage />} />
          <Route path="/history" element={<AnalysisHistoryPage />} />
          <Route path="/match" element={<Navigate to="/analysis" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
