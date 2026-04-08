import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { TelemetryIngestDto } from './dto/telemetry-ingest.dto';
import { TelemetryService } from './telemetry.service';

@Controller(['api/v1/telemetry', 'telemetry'])
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Public()
  @Post('ingest')
  ingest(
    @Body() payload: TelemetryIngestDto,
    @Headers('x-ingest-token') ingestToken?: string,
  ) {
    return this.telemetryService.ingest(payload, ingestToken);
  }
}
