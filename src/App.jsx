// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, OfficerRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import Navbar from './components/Navbar'

import Landing              from './pages/Landing'
import Register             from './pages/Register'
import Login                from './pages/Login'
import Dashboard            from './pages/Dashboard'
import NewApplication       from './pages/NewApplication'
import ApplicationDetail    from './pages/ApplicationDetail'
import AdminDashboard       from './pages/AdminDashboard'
import AdminApplicationView from './pages/AdminApplicationView'
import AdminAnalytics       from './pages/AdminAnalytics'
import AdminRegisterUser    from './pages/AdminRegisterUser'
import AdminNewApplication  from './pages/AdminNewApplication'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/"         element={<Landing />} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />

          <Route path="/dashboard"       element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/apply"           element={<ProtectedRoute><NewApplication /></ProtectedRoute>} />
          <Route path="/application/:id" element={<ProtectedRoute><ApplicationDetail /></ProtectedRoute>} />

          <Route path="/admin"             element={<OfficerRoute><AdminDashboard /></OfficerRoute>} />
          <Route path="/admin/analytics"   element={<OfficerRoute><AdminAnalytics /></OfficerRoute>} />
          <Route path="/admin/register"        element={<OfficerRoute><AdminRegisterUser /></OfficerRoute>} />
          <Route path="/admin/new-application"  element={<OfficerRoute><AdminNewApplication /></OfficerRoute>} />
          <Route path="/admin/:id"         element={<OfficerRoute><AdminApplicationView /></OfficerRoute>} />

          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
