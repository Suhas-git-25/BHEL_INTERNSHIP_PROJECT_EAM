import { Navigate, Outlet, Route, Routes, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import HardwarePage from "./pages/Hardware.jsx";
import SoftwarePage from "./pages/Software.jsx";
import HoldersPage from "./pages/Holders.jsx";
import IssuePage from "./pages/Issue.jsx";
import TakeBackPage from "./pages/TakeBack.jsx";
import StatsPage from "./pages/Stats.jsx";
import SearchPage from "./pages/Search.jsx";
import { clearSession, loggedIn } from "./api.js";

function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <NavLink className="text-lg font-semibold text-white hover:text-sky-300" to="/">
            EAM
          </NavLink>
          <nav className="flex flex-wrap gap-2 text-sm">
            <NavLink
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"}`
              }
              to="/"
            >
              Home
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"}`
              }
              to="/hardware"
            >
              Hardware
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"}`
              }
              to="/software"
            >
              Software
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"}`
              }
              to="/holders"
            >
              People
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"}`
              }
              to="/issue"
            >
              Issue
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"}`
              }
              to="/take-back"
            >
              Take back
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"}`
              }
              to="/search"
            >
              Search
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"}`
              }
              to="/stats"
            >
              Stats
            </NavLink>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-rose-300 hover:bg-slate-800"
              onClick={() => {
                clearSession();
                window.location.href = "/login";
              }}
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        Enterprise Asset Management · Sample UI wired to Express + Oracle API
      </footer>
    </div>
  );
}

function PrivateRoute({ children }) {
  if (!loggedIn()) {
    return <Navigate replace to="/login" />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="hardware" element={<HardwarePage />} />
        <Route path="software" element={<SoftwarePage />} />
        <Route path="holders" element={<HoldersPage />} />
        <Route path="issue" element={<IssuePage />} />
        <Route path="take-back" element={<TakeBackPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="stats" element={<StatsPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}
