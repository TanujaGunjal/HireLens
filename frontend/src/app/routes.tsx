import { createBrowserRouter } from "react-router";
import { AdminRoute, UserRoute } from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import UserDashboard from "./pages/UserDashboard";
import CreateResume from "./pages/CreateResume";
import PasteJD from "./pages/PasteJD";
import ATSScore from "./pages/ATSScore";
import ATSAddJD from "./pages/ATSAddJD";
import TemplateSelection from "./pages/TemplateSelection";
import DownloadResume from "./pages/DownloadResume";
import Interview from "./pages/Interview";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import ResumeStats from "./pages/admin/ResumeStats";
import TemplateManagement from "./pages/admin/TemplateManagement";
import KeywordsLibrary from "./pages/admin/KeywordsLibrary";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/auth",
    Component: AuthPage,
  },
  {
    path: "/dashboard",
    Component: () => (
      <UserRoute>
        <UserDashboard />
      </UserRoute>
    ),
  },
  {
    path: "/create-resume",
    Component: () => (
      <UserRoute>
        <CreateResume />
      </UserRoute>
    ),
  },
  {
    path: "/paste-jd",
    Component: () => (
      <UserRoute>
        <PasteJD />
      </UserRoute>
    ),
  },
  {
    path: "/ats-score",
    Component: () => (
      <UserRoute>
        <ATSScore />
      </UserRoute>
    ),
  },
  {
    path: "/ats/add-jd",
    Component: () => (
      <UserRoute>
        <ATSAddJD />
      </UserRoute>
    ),
  },
  {
    path: "/templates",
    Component: () => (
      <UserRoute>
        <TemplateSelection />
      </UserRoute>
    ),
  },
  {
    path: "/download",
    Component: () => (
      <UserRoute>
        <DownloadResume />
      </UserRoute>
    ),
  },
  {
    path: "/interview/:resumeId/:jdId",
    Component: () => (
      <UserRoute>
        <Interview />
      </UserRoute>
    ),
  },
  {
    path: "/admin",
    Component: () => (
      <AdminRoute>
        <AdminDashboard />
      </AdminRoute>
    ),
  },
  {
    path: "/admin/users",
    Component: () => (
      <AdminRoute>
        <UserManagement />
      </AdminRoute>
    ),
  },
  {
    path: "/admin/stats",
    Component: () => (
      <AdminRoute>
        <ResumeStats />
      </AdminRoute>
    ),
  },
  {
    path: "/admin/templates",
    Component: () => (
      <AdminRoute>
        <TemplateManagement />
      </AdminRoute>
    ),
  },
  {
    path: "/admin/keywords",
    Component: () => (
      <AdminRoute>
        <KeywordsLibrary />
      </AdminRoute>
    ),
  },
]);
