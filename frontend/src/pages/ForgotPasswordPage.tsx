import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Droplets,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/device-binding";
import { http } from "@/lib/http";

type Step = "request" | "reset";

type ApiEnvelope = { success: boolean; message: string };

const ForgotPasswordPage = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("request");

  // Step 1
  const [email, setEmail] = useState("");
  const [isRequestingCode, setIsRequestingCode] = useState(false);

  // Step 2
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return;
    }

    setIsRequestingCode(true);
    try {
      await http.post<ApiEnvelope>("/auth/forgot-password", {
        email: trimmedEmail,
      });

      toast({
        title: "Đã gửi mã xác nhận",
        description: `Kiểm tra hộp thư của ${trimmedEmail} để lấy mã 6 chữ số.`,
      });
      setStep("reset");
    } catch (error) {
      toast({
        title: "Có lỗi xảy ra",
        description: getApiErrorMessage(error, "Vui lòng thử lại"),
        variant: "destructive",
      });
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.trim().length !== 6) {
      toast({ title: "Mã xác nhận gồm 6 chữ số", variant: "destructive" });
      return;
    }

    if (newPassword.length < 8) {
      toast({ title: "Mật khẩu mới tối thiểu 8 ký tự", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Mật khẩu xác nhận không khớp", variant: "destructive" });
      return;
    }

    setIsResetting(true);
    try {
      await http.post<ApiEnvelope>("/auth/reset-password", {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });

      toast({
        title: "Đặt lại mật khẩu thành công",
        description: "Vui lòng đăng nhập bằng mật khẩu mới.",
      });
      navigate("/login");
    } catch (error) {
      toast({
        title: "Đặt lại mật khẩu thất bại",
        description: getApiErrorMessage(
          error,
          "Mã không đúng hoặc đã hết hạn. Vui lòng thử lại.",
        ),
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Droplets className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">Nhà tôm</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            {step === "request" ? "Quên mật khẩu" : "Đặt lại mật khẩu"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {step === "request"
              ? "Nhập email để nhận mã xác nhận"
              : `Nhập mã đã gửi tới ${email}`}
          </p>
        </div>

        {step === "request" ? (
          <form
            onSubmit={handleRequestCode}
            className="bg-card rounded-xl border border-border shadow-card p-6 space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gradient-ocean text-primary-foreground border-0"
              disabled={isRequestingCode}
            >
              {isRequestingCode ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Gửi mã xác nhận
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Quay lại đăng nhập
              </Link>
            </p>
          </form>
        ) : (
          <form
            onSubmit={handleReset}
            className="bg-card rounded-xl border border-border shadow-card p-6 space-y-5"
          >
            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="code">Mã xác nhận (6 chữ số)</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className="pl-10 text-center tracking-[0.4em] text-lg"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* New password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Tối thiểu 8 ký tự"
                  className="pl-10 pr-10"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu mới"
                  className="pl-10 pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gradient-ocean text-primary-foreground border-0"
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Đang xử lý...
                </>
              ) : (
                "Đặt lại mật khẩu"
              )}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setStep("request")}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Đổi email
              </button>
              <button
                type="button"
                disabled={isRequestingCode}
                onClick={async () => {
                  if (!email.trim()) return;
                  setIsRequestingCode(true);
                  try {
                    await http.post<ApiEnvelope>("/auth/forgot-password", {
                      email: email.trim(),
                    });
                    toast({ title: "Đã gửi lại mã xác nhận" });
                  } catch {
                    toast({
                      title: "Không thể gửi lại mã",
                      variant: "destructive",
                    });
                  } finally {
                    setIsRequestingCode(false);
                  }
                }}
                className="text-primary hover:underline disabled:opacity-50"
              >
                {isRequestingCode ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                ) : (
                  "Gửi lại mã"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
