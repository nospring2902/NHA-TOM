import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Droplets, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { saveAuthSession } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/device-binding";
import { http } from "@/lib/http";

type LoginResponse = {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };
  };
};

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await http.post<LoginResponse>("/auth/login", {
        email: email.trim(),
        password,
      });

      saveAuthSession({
        accessToken: response.data.data.accessToken,
        refreshToken: response.data.data.refreshToken,
        user: response.data.data.user,
      });

      toast({
        title: "Đăng nhập thành công",
        description: `Xin chào ${response.data.data.user.fullName}`,
      });
      navigate(response.data.data.user.role === "ADMIN" ? "/admin/devices" : "/home");
    } catch (error) {
      const message = getApiErrorMessage(error, "Đăng nhập thất bại");
      setErrorMessage(message);
      toast({
        title: "Đăng nhập thất bại",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Droplets className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">Nhà tôm </span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Đăng nhập</h1>
          <p className="text-muted-foreground mt-1">Chào mừng bạn trở lại</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-xl border border-border shadow-card p-6 space-y-5"
        >
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="email@example.com"
                className="pl-10"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mật khẩu</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-primary hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pl-10 pr-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          <Button
            type="submit"
            className="w-full gradient-ocean text-primary-foreground border-0"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Đang đăng nhập...
              </>
            ) : (
              "Đăng nhập"
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Đăng ký
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
