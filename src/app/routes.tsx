import { createBrowserRouter, Navigate } from "react-router";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import BhwDashboard from "./pages/BhwDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ResidentPortal from "./pages/ResidentPortal";
import BarangayPortal from "./pages/BarangayPortal";
import HealthCenterPortal from "./pages/HealthCenterPortal";
import NurseDashboard from "./pages/NurseDashboard";
import SuperMegaAdminDashboard from "./pages/SuperMegaAdminDashboard";
import NotFoundPage from "./pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/nurse",
    Component: NurseDashboard,
  },
  {
    path: "/bhw",
    Component: BhwDashboard,
  },
  {
    path: "/admin",
    Component: AdminDashboard,
  },
  {
    path: "/dashboard",
    Component: AdminDashboard,
  },
  {
    path: "/super-mega-admin",
    Component: SuperMegaAdminDashboard,
  },
  {
    path: "/resident",
    Component: ResidentPortal,
  },
  {
    path: "/resident/barangay",
    Component: BarangayPortal,
  },
  {
    path: "/resident/health",
    Component: HealthCenterPortal,
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);

