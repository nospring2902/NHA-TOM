import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Droplets, User, Mail, Lock, Phone, Calendar, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VerificationStepper from "@/components/VerificationStepper";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/device-binding";
import { http } from "@/lib/http";
import { saveVerificationSession } from "@/lib/verification";

type RegisterResponse = {
  success: boolean;
  message: string;
  data: {
    email: string;
    phone: string | null;
    emailSent?: boolean;
    phoneSent?: boolean;
  };
};

const RegisterPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      const response = await http.post<RegisterResponse>("/auth/register", {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
      });

      saveVerificationSession({
        email: response.data.data.email,
        phone: response.data.data.phone ?? phone.trim(),
      });

      toast({
        title: "Đăng ký thành công",
        description: "Vui lòng xác minh email và số điện thoại.",
      });

      navigate("/verify-email");
    } catch (error) {
      const message = getApiErrorMessage(error, "Đăng ký thất bại");
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
            <span className="text-2xl font-bold text-foreground">AquaShrimp</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Tạo tài khoản</h1>
          <p className="text-muted-foreground mt-1">Bắt đầu giám sát ao tôm của bạn</p>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <VerificationStepper currentStep={1} />
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  required
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ngày sinh</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="date" className="pl-10" />
              </div>
            </div>
            
          </div>

          

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

    </div>
  );
};

export default RegisterPage;