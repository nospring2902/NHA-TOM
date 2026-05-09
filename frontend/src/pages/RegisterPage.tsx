import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Droplets, User, Mail, Lock, Phone, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/device-binding";
import { saveAuthSession } from "@/lib/auth";
import { http } from "@/lib/http";

type RegisterResponse = {
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

type MeResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
};

const RegisterPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
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
      const registerResponse = await http.post<RegisterResponse>("/auth/register", {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      });

      const { accessToken, refreshToken } = registerResponse.data.data;

      saveAuthSession({
        accessToken,
        refreshToken,
        user: registerResponse.data.data.user,
      });

      const meResponse = await http.get<MeResponse>("/auth/me");

      saveAuthSession({
        accessToken,
        refreshToken,
        user: meResponse.data.data,
      });

      toast({
        title: "Đăng ký thành công",
        description: `Xin chào ${meResponse.data.data.fullName}`,
      });

      navigate("/dashboard");
    } catch (error) {
      const message = getApiErrorMessage(error, "Đăng ký thất bại");
      setErrorMessage(message);
      toast({
        title: "Đăng ký thất bại",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Droplets className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">Nhà tôm </span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Tạo tài khoản</h1>
          <p className="text-muted-foreground mt-1">Bắt đầu giám sát ao tôm của bạn</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Họ tên</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Nguyễn Văn A"
                  className="pl-10"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="0901234567"
                  className="pl-10"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </div>
          </div>

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
            <Label>Mật khẩu</Label>
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
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo tài khoản...
              </>
            ) : (
              "Đăng ký"
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Đã có tài khoản?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Đăng nhập</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
