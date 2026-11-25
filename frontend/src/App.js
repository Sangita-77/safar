import "@/App.css";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Show } from "@clerk/react";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AppShell } from "@/components/AppShell";
import { MeProvider, useMe } from "@/lib/me";
import Landing from "@/pages/Landing";
import { SignInPage, SignUpPage } from "@/pages/AuthPages";
import CustomerHome from "@/pages/CustomerHome";
import Book from "@/pages/Book";
import Trip from "@/pages/Trip";
import Trips from "@/pages/Trips";
import Account from "@/pages/Account";
import DriverApply from "@/pages/DriverApply";
import DriverHome from "@/pages/DriverHome";
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminDrivers from "@/pages/admin/AdminDrivers";
import AdminBookings from "@/pages/admin/AdminBookings";
import AdminFares from "@/pages/admin/AdminFares";
import AdminUsers from "@/pages/admin/AdminUsers";

function RoleHome() {
  const { data: me } = useMe();
  if (me?.role === "admin") return <AdminOverview />;
  if (me?.role === "driver") return <DriverHome />;
  return <CustomerHome />;
}

function RootGate() {
  return (
    <>
      <Show when="signed-out"><Landing /></Show>
      <Show when="signed-in"><AppShell><Outlet /></AppShell></Show>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ClerkAuthProvider>
        <MeProvider>
          <OfflineBanner />
          <Toaster position="top-center" richColors />
          <Routes>
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            <Route path="/" element={<RootGate />}>
              <Route index element={<RoleHome />} />
              <Route path="book/:service" element={<Book />} />
              <Route path="trip/:id" element={<Trip />} />
              <Route path="trips" element={<Trips />} />
              <Route path="account" element={<Account />} />
              <Route path="driver/apply" element={<DriverApply />} />
              <Route path="admin/drivers" element={<AdminDrivers />} />
              <Route path="admin/bookings" element={<AdminBookings />} />
              <Route path="admin/fares" element={<AdminFares />} />
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="*" element={<RoleHome />} />
            </Route>
          </Routes>
        </MeProvider>
      </ClerkAuthProvider>
    </BrowserRouter>
  );
}

export default App;
