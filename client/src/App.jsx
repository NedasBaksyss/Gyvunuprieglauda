import { Route, Routes } from 'react-router-dom';
import PublicLayout from './components/PublicLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import AnimalPage from './pages/AnimalPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { AuthProvider } from './hooks/useAuth.jsx';

export default function App() {
  return (
    <AuthProvider><Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="gyvunai/:id" element={<AnimalPage />} />
        <Route path="prisijungti" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes></AuthProvider>
  );
}
