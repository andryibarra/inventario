import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from '../features/auth/AuthProvider'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { PublicOnly, RequireAuth } from '../features/auth/guards'
import { LoginPage } from '../features/auth/LoginPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { SignupPage } from '../features/auth/SignupPage'
import { CreateBusinessPage } from '../features/business/CreateBusinessPage'
import { RequireBusiness } from '../features/business/RequireBusiness'
import { SettingsPage } from '../features/business/SettingsPage'
import { HomePage } from '../features/dashboard/HomePage'
import { MovementFormPage } from '../features/inventory/MovementFormPage'
import { MovementsPage } from '../features/inventory/MovementsPage'
import { CategoriesPage } from '../features/products/CategoriesPage'
import { ProductDetailPage } from '../features/products/ProductDetailPage'
import { ProductFormPage } from '../features/products/ProductFormPage'
import { ProductsPage } from '../features/products/ProductsPage'
import { AppLayout } from './AppLayout'
import { NotFoundPage } from './NotFoundPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/ingresar" element={<LoginPage />} />
              <Route path="/registro" element={<SignupPage />} />
              <Route path="/recuperar-clave" element={<ForgotPasswordPage />} />
            </Route>
            <Route path="/restablecer-clave" element={<ResetPasswordPage />} />

            <Route element={<RequireAuth />}>
              <Route path="/crear-negocio" element={<CreateBusinessPage />} />
              <Route element={<RequireBusiness />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/productos" element={<ProductsPage />} />
                  <Route path="/productos/nuevo" element={<ProductFormPage />} />
                  <Route path="/productos/categorias" element={<CategoriesPage />} />
                  <Route path="/productos/:productId" element={<ProductDetailPage />} />
                  <Route path="/productos/:productId/editar" element={<ProductFormPage />} />
                  <Route path="/inventario" element={<MovementsPage />} />
                  <Route path="/inventario/registrar" element={<MovementFormPage />} />
                  <Route path="/configuracion" element={<SettingsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
