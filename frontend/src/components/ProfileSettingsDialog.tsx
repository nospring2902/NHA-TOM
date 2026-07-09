import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Upload, Mail, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/device-binding";
import { clearAuthSession, getAuthSession, saveAuthSession } from "@/lib/auth";
import {
  confirmPasswordChange,
  requestPasswordChange,
  resolveAvatarUrl,
  updateDisplayName,
  uploadAvatar,
} from "@/lib/users";

type ProfileSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  onProfileUpdated: (patch: { fullName?: string; avatarUrl?: string | null }) => void;
};

type PasswordPhase = "request" | "confirm";

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

export const ProfileSettingsDialog = ({
  open,
  onOpenChange,
  displayName,
  email,
  avatarUrl,
  onProfileUpdated,
}: ProfileSettingsDialogProps) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nameValue, setNameValue] = useState(displayName);
  const [isSavingName, setIsSavingName] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [passwordPhase, setPasswordPhase] = useState<PasswordPhase>("request");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setNameValue(displayName);
    }
  }, [open, displayName]);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setAvatarPreview(null);
      setPasswordPhase("request");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setConfirmationCode("");
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const resolvedAvatar = avatarPreview ?? resolveAvatarUrl(avatarUrl);

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      toast({ title: "Tên hiển thị không được để trống", variant: "destructive" });
      return;
    }

    setIsSavingName(true);
    try {
      const response = await updateDisplayName(trimmed);
      onProfileUpdated({ fullName: response.data.fullName });

      const session = getAuthSession();
      if (session) {
        saveAuthSession({
          ...session,
          user: { ...session.user, fullName: response.data.fullName },
        });
      }

      toast({ title: "Đã cập nhật tên hiển thị" });
    } catch (error) {
      toast({
        title: "Không thể cập nhật tên",
        description: getApiErrorMessage(error, "Vui lòng thử lại"),
        variant: "destructive",
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({ title: "Chỉ hỗ trợ tải ảnh", variant: "destructive" });
      return;
    }

    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setSelectedFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile) {
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const response = await uploadAvatar(selectedFile);
      onProfileUpdated({ avatarUrl: response.data.avatarUrl });
      setSelectedFile(null);
      toast({ title: "Đã cập nhật ảnh đại diện" });
    } catch (error) {
      toast({
        title: "Không thể tải ảnh lên",
        description: getApiErrorMessage(error, "Vui lòng thử lại"),
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRequestPasswordChange = async () => {
    if (!currentPassword) {
      toast({ title: "Vui lòng nhập mật khẩu hiện tại", variant: "destructive" });
      return;
    }

    if (newPassword.length < 8) {
      toast({ title: "Mật khẩu mới tối thiểu 8 ký tự", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({ title: "Mật khẩu xác nhận không khớp", variant: "destructive" });
      return;
    }

    setIsSubmittingPassword(true);
    try {
      await requestPasswordChange({ currentPassword, newPassword });
      setPasswordPhase("confirm");
      toast({
        title: "Đã gửi mã xác nhận",
        description: `Kiểm tra email ${email} để lấy mã xác nhận.`,
      });
    } catch (error) {
      toast({
        title: "Không thể đổi mật khẩu",
        description: getApiErrorMessage(error, "Vui lòng thử lại"),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleConfirmPasswordChange = async () => {
    if (confirmationCode.trim().length !== 6) {
      toast({ title: "Mã xác nhận gồm 6 chữ số", variant: "destructive" });
      return;
    }

    setIsSubmittingPassword(true);
    try {
      await confirmPasswordChange(confirmationCode.trim());
      toast({
        title: "Đổi mật khẩu thành công",
        description: "Vui lòng đăng nhập lại bằng mật khẩu mới.",
      });
      onOpenChange(false);
      clearAuthSession();
      navigate("/login");
    } catch (error) {
      toast({
        title: "Xác nhận thất bại",
        description: getApiErrorMessage(error, "Mã không đúng hoặc đã hết hạn"),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cài đặt thông tin cá nhân</DialogTitle>
          <DialogDescription>
            Cập nhật tên hiển thị, ảnh đại diện và mật khẩu của bạn.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
            <TabsTrigger value="password">Mật khẩu</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 pt-4">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="w-20 h-20">
                {resolvedAvatar ? (
                  <AvatarImage src={resolvedAvatar} alt={displayName} />
                ) : null}
                <AvatarFallback className="gradient-ocean text-primary-foreground text-xl font-bold">
                  {getInitials(displayName || "Người dùng")}
                </AvatarFallback>
              </Avatar>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSelectFile}
              />

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1.5" /> Chọn ảnh
                </Button>
                {selectedFile && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleUploadAvatar}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar && (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    )}
                    Lưu ảnh
                  </Button>
                )}
              </div>
              {selectedFile && (
                <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Tên hiển thị</Label>
              <Input
                id="displayName"
                value={nameValue}
                onChange={(event) => setNameValue(event.target.value)}
                placeholder="Nhập tên hiển thị"
              />
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={handleSaveName}
              disabled={isSavingName || nameValue.trim() === displayName.trim()}
            >
              {isSavingName && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Lưu thay đổi
            </Button>
          </TabsContent>

          <TabsContent value="password" className="space-y-4 pt-4">
            {passwordPhase === "request" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Mật khẩu mới</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">Xác nhận mật khẩu mới</Label>
                  <Input
                    id="confirmNewPassword"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                  />
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Vì lý do bảo mật, chúng tôi sẽ gửi mã xác nhận 6 chữ số tới email{" "}
                    <span className="font-medium text-foreground">{email}</span> để hoàn tất
                    việc đổi mật khẩu.
                  </span>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleRequestPasswordChange}
                  disabled={isSubmittingPassword}
                >
                  {isSubmittingPassword && (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  )}
                  Gửi mã xác nhận
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Nhập mã xác nhận 6 chữ số đã được gửi tới{" "}
                    <span className="font-medium text-foreground">{email}</span>.
                  </span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmationCode">Mã xác nhận</Label>
                  <Input
                    id="confirmationCode"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmationCode}
                    onChange={(event) =>
                      setConfirmationCode(event.target.value.replace(/\D/g, ""))
                    }
                    placeholder="000000"
                    className="text-center tracking-[0.5em] text-lg"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleConfirmPasswordChange}
                  disabled={isSubmittingPassword}
                >
                  {isSubmittingPassword && (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  )}
                  Xác nhận đổi mật khẩu
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setPasswordPhase("request");
                    setConfirmationCode("");
                  }}
                  disabled={isSubmittingPassword}
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Quay lại
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettingsDialog;
