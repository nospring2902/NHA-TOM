import { useMemo, useState } from "react";
import { Loader2, Link2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  bindDeviceToPond,
  BoundDevice,
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

type AddDeviceModalProps = {
  pondId?: string;
  onBoundSuccess: (device: BoundDevice) => void;
  triggerLabel?: string;
  triggerClassName?: string;
};

export const AddDeviceModal = ({
  pondId,
  onBoundSuccess,
  triggerLabel = "+ Thêm thiết bị mới",
  triggerClassName,
}: AddDeviceModalProps) => {
  const [open, setOpen] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const serialIsValid = useMemo(() => SERIAL_PATTERN.test(serialNumber), [serialNumber]);

  const handleSerialChange = (value: string) => {
    const formatted = formatSerialNumberInput(value);
    setSerialNumber(formatted);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    if (!pondId || !serialIsValid) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await bindDeviceToPond(pondId, serialNumber);
      onBoundSuccess(result.data);
      toast({
        title: "Kết nối thành công",
        description: result.message,
      });
      setOpen(false);
      setSerialNumber("");
    } catch (error) {
      const message = getApiErrorMessage(error, "Không thể kết nối thiết bị. Vui lòng thử lại.");
      setErrorMessage(message);
      toast({
        title: "Kết nối thất bại",
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
          setErrorMessage(null);
          setSerialNumber("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          className={cn("gradient-ocean text-primary-foreground border-0", triggerClassName)}
          disabled={!pondId}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm thiết bị IoT vào ao</DialogTitle>
          <DialogDescription>
            Nhập mã Serial thiết bị theo định dạng AS-XXXX-XXXX để kết nối vào ao hiện tại.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="serial-input">Mã Serial thiết bị</Label>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="serial-input"
              value={serialNumber}
              onChange={(event) => handleSerialChange(event.target.value)}
              placeholder="AS-2026-0001"
              className="pl-10 tracking-[0.08em]"
              maxLength={12}
              autoComplete="off"
            />
          </div>
          {/* <p className="text-xs text-muted-foreground">
            
          </p> */}
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          {!errorMessage && serialNumber && !serialIsValid && (
            <p className="text-sm text-coral">Serial chưa đúng định dạng AS-XXXX-XXXX</p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!serialIsValid || isSubmitting || !pondId}
            className="min-w-40"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang kết nối...
              </>
            ) : (
              "Xác nhận kết nối"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
