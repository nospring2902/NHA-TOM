import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Droplets, Phone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import VerificationStepper from "@/components/VerificationStepper";
import { getApiErrorMessage } from "@/lib/device-binding";
import { http } from "@/lib/http";
import { clearVerificationSession, getVerificationSession } from "@/lib/verification";

const VerifyPhonePage = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const session = getVerificationSession();

  useEffect(() => {
    if (!session) {
      toast.error("Vui lòng đăng ký trước khi xác minh");
      navigate("/register");
    }
  }, [navigate, session]);

  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...code];
    next[i] = v;
    setCode(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.join("").length !== 6) {
      toast.error("Vui lòng nhập đủ 6 chữ số");
      return;
    }

    if (!session) {
      toast.error("Thiếu thông tin đăng ký");
      navigate("/register");
      return;
    }

    setLoading(true);
    try {
      await http.post("/auth/verify-phone", {
        email: session.email,
        code: code.join(""),
      });

      setDone(true);
      toast.success("Xác minh số điện thoại thành công");
      clearVerificationSession();
      setTimeout(() => navigate("/login"), 1500);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Xác minh số điện thoại thất bại"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!session) {
      toast.error("Thiếu thông tin đăng ký");
      navigate("/register");
      return;
    }

    try {
      await http.post("/auth/resend-phone", { email: session.email });
      toast.success("Đã gửi lại mã OTP");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể gửi lại mã OTP"));
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
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <VerificationStepper currentStep={3} />

          {done ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full gradient-ocean inline-flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Hoàn tất xác minh!</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Đang chuyển đến trang đăng nhập...
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full gradient-ocean inline-flex items-center justify-center mb-3">
                  <Phone className="w-7 h-7 text-primary-foreground" />
                </div>
                <h1 className="text-xl font-bold text-foreground">Xác minh số điện thoại</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Mã OTP đã được gửi đến số điện thoại của bạn
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex justify-between gap-2">
                  {code.map((d, i) => (
                    <Input
                      key={i}
                      ref={(el) => (inputs.current[i] = el)}
                      value={d}
                      onChange={(e) => handleChange(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !d && i > 0) inputs.current[i - 1]?.focus();
                      }}
                      className="w-12 h-12 text-center text-lg font-bold"
                      inputMode="numeric"
                      maxLength={1}
                    />
                  ))}
                </div>

                <Button type="submit" disabled={loading} className="w-full gradient-ocean text-primary-foreground border-0">
                  {loading ? "Đang xác minh..." : "Hoàn tất"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Không nhận được mã?{" "}
                  <button type="button" onClick={handleResend} className="text-primary font-medium hover:underline">
                    Gửi lại
                  </button>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyPhonePage;
