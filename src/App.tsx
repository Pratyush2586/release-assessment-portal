import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewAssessment } from './pages/NewAssessment';
import { RequestDetail } from './pages/RequestDetail';
import { Results } from './pages/Results';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/request/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <NewAssessment />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/request/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <RequestDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/request/:id/results"
            element={
              <ProtectedRoute>
                <Layout>
                  <Results />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
