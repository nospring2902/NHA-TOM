import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Eye, EyeOff, Loader2, Plus } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import {
  type AdminDevice,
  getAdminDeviceAccessToken,
  listAdminDevices,
  provisionAdminDevice,
} from '@/lib/admin-devices';
import { getAuthSession } from '@/lib/auth';
import { formatSerialNumberInput, getApiErrorMessage, SERIAL_PATTERN } from '@/lib/device-binding';

const statusLabelMap: Record<string, string> = {
  INACTIVE: 'INACTIVE',
  WAITING_SIGNAL: 'WAITING_SIGNAL',
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  ERROR: 'ERROR',
  MAINTENANCE: 'MAINTENANCE',
};

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  INACTIVE: 'outline',
  WAITING_SIGNAL: 'secondary',
  ONLINE: 'default',
  OFFLINE: 'outline',
  ERROR: 'destructive',
  MAINTENANCE: 'secondary',
};

const AdminDevicePage = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<AdminDevice[]>([]);
  const [serialNumber, setSerialNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [revealedTokens, setRevealedTokens] = useState<Record<string, string>>({});
  const [tokenLoadingMap, setTokenLoadingMap] = useState<Record<string, boolean>>({});

  const serialIsValid = useMemo(() => SERIAL_PATTERN.test(serialNumber), [serialNumber]);

  const ensureAdmin = useCallback(() => {
    const session = getAuthSession();
    if (!session) {
      navigate('/login');
      return false;
    }

    if (session.user.role !== 'ADMIN') {
      navigate('/home');
      return false;
    }

    return true;
  }, [navigate]);

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await listAdminDevices();
      setDevices(response.data);
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không thể tải danh sách thiết bị');
      toast({
        title: 'Tải dữ liệu thất bại',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ensureAdmin()) {
      return;
    }

    void fetchDevices();
  }, [ensureAdmin, fetchDevices]);

  const handleProvision = async () => {
    if (!serialIsValid) {
      return;
    }

    setIsProvisioning(true);

    try {
      const response = await provisionAdminDevice(serialNumber);
      const provisioned = response.data;

      setSerialNumber('');
      setRevealedTokens((current) => ({
        ...current,
        [provisioned.id]: provisioned.accessToken,
      }));

      await fetchDevices();

      toast({
        title: 'Provision thành công',
        description: `Thiết bị ${provisioned.serialNumber} đã được tạo trên ThingsBoard`,
      });
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không thể provision thiết bị');
      toast({
        title: 'Provision thất bại',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleToggleToken = async (deviceId: string) => {
    if (revealedTokens[deviceId]) {
      setRevealedTokens((current) => {
        const clone = { ...current };
        delete clone[deviceId];
        return clone;
      });
      return;
    }

    setTokenLoadingMap((current) => ({
      ...current,
      [deviceId]: true,
    }));

    try {
      const response = await getAdminDeviceAccessToken(deviceId);
      setRevealedTokens((current) => ({
        ...current,
        [deviceId]: response.data.accessToken,
      }));
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không thể lấy access token của thiết bị');
      toast({
        title: 'Không thể hiển thị token',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setTokenLoadingMap((current) => ({
        ...current,
        [deviceId]: false,
      }));
    }
  };

  const handleCopyToken = async (deviceId: string) => {
    const token = revealedTokens[deviceId];
    if (!token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(token);
      toast({
        title: 'Đã copy',
        description: 'Access token đã được copy vào clipboard',
      });
    } catch {
      toast({
        title: 'Không thể copy token',
        description: 'Trình duyệt không cho phép truy cập clipboard',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Device Provisioning</CardTitle>
            <CardDescription>
              Tạo thiết bị mới trên ThingsBoard, lưu token an toàn tại DB và quản lý kho thiết bị.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="admin-serial">Serial Number</Label>
                <Input
                  id="admin-serial"
                  value={serialNumber}
                  onChange={(event) => setSerialNumber(formatSerialNumberInput(event.target.value))}
                  placeholder="AS-2026-0001"
                  maxLength={12}
                  autoComplete="off"
                  className="tracking-[0.08em]"
                />
                {serialNumber.length > 0 && !serialIsValid && (
                  <p className="text-sm text-destructive">Serial chưa đúng định dạng AS-XXXX-XXXX</p>
                )}
              </div>
              <div className="flex items-end">
                <Button onClick={handleProvision} disabled={!serialIsValid || isProvisioning} className="w-full md:w-auto">
                  {isProvisioning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang provision...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Provision Device
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách thiết bị trong kho</CardTitle>
            <CardDescription>
              Theo dõi trạng thái thiết bị, quyền sở hữu và access token dùng cho simulator/bind flow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tải thiết bị...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SN</TableHead>
                    <TableHead>TB-ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Access Token</TableHead>
                    <TableHead className="whitespace-nowrap">Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Chưa có thiết bị nào được provision
                      </TableCell>
                    </TableRow>
                  ) : (
                    devices.map((device) => {
                      const token = revealedTokens[device.id];
                      const tokenLoading = tokenLoadingMap[device.id] ?? false;

                      return (
                        <TableRow key={device.id}>
                          <TableCell className="font-medium">{device.serialNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{device.tbDeviceId ?? '-'}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariantMap[device.status] ?? 'outline'}>
                              {statusLabelMap[device.status] ?? device.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {device.owner ? (
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">{device.owner.fullName}</p>
                                <p className="text-xs text-muted-foreground">{device.owner.email}</p>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Chưa có người dùng nhận thiết bị</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{token ?? '***'}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleToggleToken(device.id)}
                                disabled={tokenLoading || !device.accessTokenMasked}
                              >
                                {tokenLoading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : token ? (
                                  <>
                                    <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                                    Hide
                                  </>
                                ) : (
                                  <>
                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                    Show
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleCopyToken(device.id)}
                                disabled={!token}
                              >
                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                                Copy
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(device.createdAt).toLocaleString('vi-VN')}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminDevicePage;
