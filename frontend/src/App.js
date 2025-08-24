
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import NavBar from './components/NavBar';
import Feed from './pages/Feed';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import VideoPage from './pages/VideoPage';
import AdminPanel from './pages/AdminPanel';
import VideoUploadForm from './components/VideoUploadForm';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className={darkMode ? 'app-container dark' : 'app-container light'}>
          <NavBar darkMode={darkMode} toggleTheme={() => setDarkMode(!darkMode)} />
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/upload" element={<VideoUploadForm />} />
            <Route path="/video/:id" element={<VideoPage />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
