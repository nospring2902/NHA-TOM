import { useMemo, useState } from "react";
import { Loader2, MapPin, Ruler, Waves } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  CreatePondAndBindResult,
  createPondAndBindDevice,
  formatSerialNumberInput,
  getApiErrorMessage,
  SERIAL_PATTERN,
} from "@/lib/device-binding";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AddPondModalProps = {
  onCreated: (result: CreatePondAndBindResult) => void;
  triggerClassName?: string;
};

export const AddPondModal = ({ onCreated, triggerClassName }: AddPondModalProps) => {
  const [open, setOpen] = useState(false);
  const [pondName, setPondName] = useState("");
  const [location, setLocation] = useState("");
  const [areaM2Input, setAreaM2Input] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const serialIsValid = useMemo(() => SERIAL_PATTERN.test(serialNumber), [serialNumber]);
  const areaM2 = Number(areaM2Input);
  const areaIsValid = Number.isFinite(areaM2) && areaM2 > 0;
  const formIsValid = pondName.trim().length > 0 && location.trim().length > 0 && areaIsValid && serialIsValid;

  const resetForm = () => {
    setPondName("");
    setLocation("");
    setAreaM2Input("");
    setSerialNumber("");
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    if (!formIsValid) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await createPondAndBindDevice({
        pondName: pondName.trim(),
        location: location.trim(),
        areaM2,
        serialNumber,
      });

      onCreated(result);
      toast({
        title: "Tạo ao thành công",
        description: "Ao tôm đã được tạo và thiết bị đã kết nối. Bạn có thể mở dashboard ngay.",
      });
      setOpen(false);
      resetForm();
    } catch (error) {
      const message = getApiErrorMessage(error, "Không thể tạo ao tôm. Vui lòng kiểm tra lại thông tin.");
      setErrorMessage(message);
      toast({
        title: "Tạo ao thất bại",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className={cn("w-full border-dashed", triggerClassName)} variant="outline">
          + Thêm ao tôm mới
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo ao tôm mới</DialogTitle>
          <DialogDescription>
            Nhập thông tin ao và mã Serial thiết bị để hệ thống tạo ao, liên kết thiết bị và khởi tạo trạng thái theo dõi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pond-name">Tên ao tôm</Label>
            <div className="relative">
              <Waves className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="pond-name"
                value={pondName}
                onChange={(event) => setPondName(event.target.value)}
                placeholder="Ví dụ: Ao Tôm C1"
                className="pl-10"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pond-location">Địa điểm ao tôm</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="pond-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Ví dụ: Phường 7, TP Cà Mau, Cà Mau"
                className="pl-10"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pond-area">Diện tích (m²)</Label>
            <div className="relative">
              <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="pond-area"
                type="number"
                min={1}
                value={areaM2Input}
                onChange={(event) => setAreaM2Input(event.target.value)}
                placeholder="Ví dụ: 2000"
                className="pl-10"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pond-serial">Mã Serial thiết bị</Label>
            <Input
              id="pond-serial"
              value={serialNumber}
              onChange={(event) => {
                setSerialNumber(formatSerialNumberInput(event.target.value));
                setErrorMessage(null);
              }}
              placeholder="AS-2026-0001"
              className="tracking-[0.08em]"
              maxLength={12}
              autoComplete="off"
            />
            {/* <p className="text-xs text-muted-foreground">
              Hệ thống sẽ tự thêm dấu gạch ngang (-) ngay khi bạn gõ tới AS để nhập Serial nhanh hơn.
            </p> */}
            {!serialIsValid && serialNumber.length > 0 && (
              <p className="text-sm text-coral">Serial chưa đúng định dạng AS-XXXX-XXXX</p>
            )}
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!formIsValid || isSubmitting} className="min-w-44">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo ao...
              </>
            ) : (
              "Xác nhận tạo ao"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
