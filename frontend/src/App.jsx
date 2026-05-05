import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OtpVerification from './pages/OtpVerification';

function AuthSuccess() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  if (token) {
    localStorage.setItem('gmail_token', token);
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/" replace />;
}

function PrivateRoute({ children }) {
  const token = localStorage.getItem('gmail_token');
  return token ? children : <Navigate to="/" />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/auth-success" element={<AuthSuccess />} />
        <Route path="/verify-otp" element={<OtpVerification />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
