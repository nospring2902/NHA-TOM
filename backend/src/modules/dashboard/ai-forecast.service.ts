import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as ort from 'onnxruntime-node';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

type DailyMetricRow = {
  day: Date;
  ph: number | null;
  dissolvedOxygen: number | null;
  temperature: number | null;
  salinity: number | null;
};

type ScalerPayload = {
  feature_columns: string[];
  feature_names: string[];
  mean: number[];
  std: number[];
};

type ForecastMetrics = {
  ph: number | null;
  dissolvedOxygen: number | null;
  temperature: number | null;
  salinity: number | null;
};

type ForecastHorizon = {
  day: number;
  metrics: ForecastMetrics;
};

type ForecastResult = {
  generatedAt: string;
  horizons: ForecastHorizon[];
};

@Injectable()
export class AiForecastService {
  private sessionPromise: Promise<ort.InferenceSession> | null = null;
  private scalerPromise: Promise<ScalerPayload> | null = null;

  async predict(rows: DailyMetricRow[]): Promise<ForecastResult> {
    try {
      const scaler = await this.loadScaler();
      const inputDays = this.getInputDays();
      const numNodes = this.getNumNodes();
      const forecastDays = this.getForecastDays();
      const targetDim = scaler.mean.length;
      const inDim = targetDim + 2;

      const orderedRows = this.normalizeRows(rows, inputDays, scaler);

      const input = new Float32Array(1 * inDim * numNodes * inputDays);

      for (let t = 0; t < inputDays; t += 1) {
        const row = orderedRows[t];
        const dayOfWeek = row.day.getUTCDay();
        const sinDow = Math.sin((2 * Math.PI * dayOfWeek) / 7);
        const cosDow = Math.cos((2 * Math.PI * dayOfWeek) / 7);
        const features = [
          this.scaleValue(row.ph, scaler.mean[0], scaler.std[0]),
          this.scaleValue(row.dissolvedOxygen, scaler.mean[1], scaler.std[1]),
          this.scaleValue(row.temperature, scaler.mean[2], scaler.std[2]),
          this.scaleValue(row.salinity, scaler.mean[3], scaler.std[3]),
          sinDow,
          cosDow,
        ];

        for (let n = 0; n < numNodes; n += 1) {
          for (let c = 0; c < inDim; c += 1) {
            const idx = ((0 * inDim + c) * numNodes + n) * inputDays + t;
            input[idx] = features[c];
          }
        }
      }

      const session = await this.loadSession();
      const feeds: Record<string, ort.Tensor> = {
        input: new ort.Tensor('float32', input, [1, inDim, numNodes, inputDays]),
      };
      const results = await session.run(feeds);
      const output = (results.forecast ?? Object.values(results)[0]) as ort.Tensor;

      const data = output.data as Float32Array;
      const outputDims = output.dims;
      const horizons = forecastDays.map((day, hIdx) => {
        return {
          day,
          metrics: {
            ph: this.readOutput(data, outputDims, 0, hIdx, scaler),
            dissolvedOxygen: this.readOutput(data, outputDims, 1, hIdx, scaler),
            temperature: this.readOutput(data, outputDims, 2, hIdx, scaler),
            salinity: this.readOutput(data, outputDims, 3, hIdx, scaler),
          },
        };
      });

      return {
        generatedAt: new Date().toISOString(),
        horizons,
      };
    } catch (error) {
      throw new InternalServerErrorException('Không thể chạy model AI dự báo');
    }
  }

  private readOutput(
    data: Float32Array,
    dims: readonly number[],
    featureIndex: number,
    horizonIndex: number,
    scaler: ScalerPayload,
  ) {
    const [, features, nodes, horizons] = dims;
    if (featureIndex >= features || horizonIndex >= horizons) {
      return null;
    }
    const nodeIndex = 0;
    const idx = ((0 * features + featureIndex) * nodes + nodeIndex) * horizons + horizonIndex;
    const value = data[idx];
    if (!Number.isFinite(value)) {
      return null;
    }

    return this.unscaleValue(value, featureIndex, scaler);
  }

  private imputeRow(row: DailyMetricRow, scaler: ScalerPayload): DailyMetricRow {
    return {
      ...row,
      ph: row.ph ?? scaler.mean[0],
      dissolvedOxygen: row.dissolvedOxygen ?? scaler.mean[1],
      temperature: row.temperature ?? scaler.mean[2],
      salinity: row.salinity ?? scaler.mean[3],
    };
  }

  private normalizeRows(
    rows: DailyMetricRow[],
    inputDays: number,
    scaler: ScalerPayload,
  ): DailyMetricRow[] {
    const sorted = rows.slice().sort((a, b) => a.day.getTime() - b.day.getTime());
    const lastDate = sorted.length > 0 ? sorted[sorted.length - 1].day : new Date();
    const byDate = new Map<string, DailyMetricRow>();
    sorted.forEach((row) => {
      byDate.set(this.toDateKey(row.day), row);
    });

    const result: DailyMetricRow[] = [];
    let lastKnown: DailyMetricRow | null = null;

    for (let offset = inputDays - 1; offset >= 0; offset -= 1) {
      const day = new Date(
        Date.UTC(
          lastDate.getUTCFullYear(),
          lastDate.getUTCMonth(),
          lastDate.getUTCDate() - offset,
        ),
      );
      const key = this.toDateKey(day);
      const baseRow =
        byDate.get(key) ??
        lastKnown ??
        this.defaultRow(day, scaler);

      const filledRow = this.imputeRow({ ...baseRow, day }, scaler);
      result.push(filledRow);
      lastKnown = filledRow;
    }

    return result;
  }

  private defaultRow(day: Date, scaler: ScalerPayload): DailyMetricRow {
    return {
      day,
      ph: scaler.mean[0],
      dissolvedOxygen: scaler.mean[1],
      temperature: scaler.mean[2],
      salinity: scaler.mean[3],
    };
  }

  private toDateKey(day: Date) {
    return day.toISOString().slice(0, 10);
  }

  private scaleValue(value: number | null, mean: number, std: number) {
    const safeValue = value ?? mean;
    if (!std || std === 0) {
      return safeValue - mean;
    }
    return (safeValue - mean) / std;
  }

  private unscaleValue(value: number, featureIndex: number, scaler: ScalerPayload) {
    const mean = scaler.mean[featureIndex] ?? 0;
    const std = scaler.std[featureIndex] ?? 1;
    return value * std + mean;
  }

  private async loadSession() {
    if (!this.sessionPromise) {
      this.sessionPromise = ort.InferenceSession.create(this.getModelPath());
    }
    return this.sessionPromise;
  }

  private async loadScaler() {
    if (!this.scalerPromise) {
      this.scalerPromise = readFile(this.getScalerPath(), 'utf-8').then((raw) => JSON.parse(raw));
    }
    return this.scalerPromise;
  }

  private getModelPath() {
    return (
      process.env.NHATOM_AI_MODEL_PATH ?? path.resolve(process.cwd(), 'ai', 'nhatom_forecast.onnx')
    );
  }

  private getScalerPath() {
    return (
      process.env.NHATOM_AI_SCALER_PATH ?? path.resolve(process.cwd(), 'ai', 'nhatom_scaler.json')
    );
  }

  private getInputDays() {
    const raw = process.env.NHATOM_AI_INPUT_DAYS;
    const value = raw ? Number(raw) : 14;
    return Number.isFinite(value) && value > 0 ? value : 14;
  }

  private getForecastDays() {
    const raw = process.env.NHATOM_AI_FORECAST_DAYS ?? '1,3,7';
    return raw
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
  }

  private getNumNodes() {
    const raw = process.env.NHATOM_AI_NUM_NODES;
    const value = raw ? Number(raw) : 5;
    return Number.isFinite(value) && value > 0 ? value : 5;
  }
}
