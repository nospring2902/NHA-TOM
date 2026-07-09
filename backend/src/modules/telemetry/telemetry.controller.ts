import { Body, Controller, Headers, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { TelemetryIngestDto } from './dto/telemetry-ingest.dto';
import { TelemetryStatusChangeDto } from './dto/telemetry-status-change.dto';
import { TelemetryService } from './telemetry.service';

/**
 * ValidationPipe riêng cho telemetry: không forbidNonWhitelisted vì
 * ThingsBoard có thể gửi kèm metadata fields như deviceName, deviceType, msgType, v.v.
 * mà không cần thiết phải khai báo hết trong DTO.
 */
const TelemetryValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: false,
});

@Controller(['api/v1/telemetry', 'telemetry'])
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Public()
  @Post('ingest')
  @UsePipes(TelemetryValidationPipe)
  ingest(
    @Body() payload: TelemetryIngestDto,
    @Headers('x-ingest-token') ingestToken?: string,
  ) {
    return this.telemetryService.ingest(payload, ingestToken);
  }

  @Public()
  @Post('status-change')
  @UsePipes(TelemetryValidationPipe)
  statusChange(
    @Body() payload: TelemetryStatusChangeDto,
    @Headers('x-ingest-token') statusChangeToken?: string,
  ) {
    return this.telemetryService.handleStatusChange(payload, statusChangeToken);
  }
}
