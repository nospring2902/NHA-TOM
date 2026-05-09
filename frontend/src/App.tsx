import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminDevicePage from "./pages/AdminDevicePage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import DashboardPage from "./pages/DashboardPage";
import NotFound from "./pages/NotFound";
import UserProfilePage from "./pages/UserProfilePage";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { FriendsProvider } from "@/contexts/FriendsContext";
import { ChatProvider } from "@/contexts/ChatContext";

const App = () => (
  <>
    <Toaster />
    <Sonner />
    <RealtimeProvider>
      <FriendsProvider>
        <ChatProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/admin/devices" element={<AdminDevicePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/users/:id" element={<UserProfilePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/:id" element={<DashboardPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ChatProvider>
      </FriendsProvider>
    </RealtimeProvider>
  </>
);

export default App;
