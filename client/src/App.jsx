import { Route, Routes } from 'react-router-dom';
import PublicLayout from './components/PublicLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import AnimalPage from './pages/AnimalPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { AuthProvider } from './hooks/useAuth.jsx';
import AdminLayout, { RequireAdmin } from './components/AdminLayout.jsx';
import AdminSpecies from './pages/AdminSpecies.jsx';
import AdminOverview from './pages/AdminOverview.jsx';
import AdminAnimals from './pages/AdminAnimals.jsx';
import AnimalForm from './pages/AnimalForm.jsx';

export default function App() {
  return (
    <AuthProvider><Routes>
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="gyvunai" element={<AdminAnimals />} />
        <Route path="gyvunai/naujas" element={<AnimalForm />} />
        <Route path="gyvunai/:id" element={<AnimalForm />} />
        <Route path="rusys" element={<RequireAdmin><AdminSpecies /></RequireAdmin>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="gyvunai/:id" element={<AnimalPage />} />
        <Route path="prisijungti" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes></AuthProvider>
  );
}
