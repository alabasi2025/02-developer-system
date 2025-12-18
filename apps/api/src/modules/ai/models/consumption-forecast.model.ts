import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import OpenAI from 'openai';

export interface ConsumptionData {
  meterId: string;
  timestamp: Date;
  consumption: number;
  temperature?: number;
  humidity?: number;
  dayOfWeek?: number;
  isHoliday?: boolean;
}

export interface ForecastResult {
  meterId: string;
  predictions: Array<{
    timestamp: Date;
    predictedConsumption: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }>;
  trends: {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentageChange: number;
    seasonalPattern: string;
  };
  insights: string[];
  modelMetrics: {
    mape: number; // Mean Absolute Percentage Error
    rmse: number; // Root Mean Square Error
    r2: number;   // R-squared
  };
}

export interface TrainingData {
  historicalData: ConsumptionData[];
  weatherData?: Array<{ date: Date; temperature: number; humidity: number }>;
  holidays?: Date[];
}

@Injectable()
export class ConsumptionForecastModel {
  private readonly logger = new Logger(ConsumptionForecastModel.name);
  private openai: OpenAI;
  private modelWeights: Map<string, number[]> = new Map();

  constructor(private readonly prisma: PrismaService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * تدريب النموذج على بيانات تاريخية
   */
  async train(data: TrainingData): Promise<{ success: boolean; metrics: Record<string, number> }> {
    this.logger.log(`Training consumption forecast model with ${data.historicalData.length} records`);

    try {
      // تحليل البيانات التاريخية
      const features = this.extractFeatures(data.historicalData);
      
      // حساب المتوسطات والانحرافات المعيارية
      const stats = this.calculateStatistics(data.historicalData);
      
      // تخزين الأوزان المحسوبة
      const meterIds = [...new Set(data.historicalData.map(d => d.meterId))];
      for (const meterId of meterIds) {
        const meterData = data.historicalData.filter(d => d.meterId === meterId);
        const weights = this.calculateWeights(meterData);
        this.modelWeights.set(meterId, weights);
      }

      // حساب مقاييس الأداء
      const metrics = {
        mape: this.calculateMAPE(data.historicalData),
        rmse: this.calculateRMSE(data.historicalData),
        r2: this.calculateR2(data.historicalData),
        trainingRecords: data.historicalData.length,
        uniqueMeters: meterIds.length,
      };

      // تسجيل التدريب في قاعدة البيانات
      await this.logTraining('consumption_forecast', metrics);

      this.logger.log(`Model trained successfully. MAPE: ${metrics.mape.toFixed(2)}%`);
      return { success: true, metrics };
    } catch (error) {
      this.logger.error(`Training failed: ${error}`);
      throw error;
    }
  }

  /**
   * التنبؤ بالاستهلاك المستقبلي
   */
  async predict(
    meterId: string,
    historicalData: ConsumptionData[],
    horizonDays: number = 7,
  ): Promise<ForecastResult> {
    this.logger.log(`Predicting consumption for meter ${meterId} for ${horizonDays} days`);

    try {
      // استخراج الميزات من البيانات التاريخية
      const features = this.extractFeatures(historicalData);
      const stats = this.calculateStatistics(historicalData);

      // استخدام OpenAI للتنبؤ المتقدم
      const aiPrediction = await this.getAIPrediction(historicalData, horizonDays);

      // دمج التنبؤات الإحصائية مع AI
      const predictions = this.generatePredictions(
        historicalData,
        horizonDays,
        aiPrediction,
        stats,
      );

      // تحليل الاتجاهات
      const trends = this.analyzeTrends(historicalData);

      // توليد الرؤى
      const insights = await this.generateInsights(historicalData, predictions, trends);

      // حساب مقاييس النموذج
      const modelMetrics = {
        mape: this.calculateMAPE(historicalData),
        rmse: this.calculateRMSE(historicalData),
        r2: this.calculateR2(historicalData),
      };

      return {
        meterId,
        predictions,
        trends,
        insights,
        modelMetrics,
      };
    } catch (error) {
      this.logger.error(`Prediction failed: ${error}`);
      throw error;
    }
  }

  /**
   * استخراج الميزات من البيانات
   */
  private extractFeatures(data: ConsumptionData[]): number[][] {
    return data.map(d => [
      d.consumption,
      d.dayOfWeek || new Date(d.timestamp).getDay(),
      d.temperature || 25,
      d.humidity || 50,
      d.isHoliday ? 1 : 0,
      new Date(d.timestamp).getHours(),
      new Date(d.timestamp).getMonth(),
    ]);
  }

  /**
   * حساب الإحصائيات الأساسية
   */
  private calculateStatistics(data: ConsumptionData[]): {
    mean: number;
    std: number;
    min: number;
    max: number;
    dailyPattern: number[];
    weeklyPattern: number[];
  } {
    const consumptions = data.map(d => d.consumption);
    const mean = consumptions.reduce((a, b) => a + b, 0) / consumptions.length;
    const variance = consumptions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / consumptions.length;
    const std = Math.sqrt(variance);

    // حساب النمط اليومي (24 ساعة)
    const dailyPattern = new Array(24).fill(0);
    const dailyCounts = new Array(24).fill(0);
    for (const d of data) {
      const hour = new Date(d.timestamp).getHours();
      dailyPattern[hour] += d.consumption;
      dailyCounts[hour]++;
    }
    for (let i = 0; i < 24; i++) {
      dailyPattern[i] = dailyCounts[i] > 0 ? dailyPattern[i] / dailyCounts[i] : mean;
    }

    // حساب النمط الأسبوعي (7 أيام)
    const weeklyPattern = new Array(7).fill(0);
    const weeklyCounts = new Array(7).fill(0);
    for (const d of data) {
      const day = new Date(d.timestamp).getDay();
      weeklyPattern[day] += d.consumption;
      weeklyCounts[day]++;
    }
    for (let i = 0; i < 7; i++) {
      weeklyPattern[i] = weeklyCounts[i] > 0 ? weeklyPattern[i] / weeklyCounts[i] : mean;
    }

    return {
      mean,
      std,
      min: Math.min(...consumptions),
      max: Math.max(...consumptions),
      dailyPattern,
      weeklyPattern,
    };
  }

  /**
   * حساب الأوزان للنموذج
   */
  private calculateWeights(data: ConsumptionData[]): number[] {
    // أوزان بسيطة بناءً على الارتباط
    const n = data.length;
    if (n < 2) return [1, 0, 0, 0, 0];

    const consumptions = data.map(d => d.consumption);
    const mean = consumptions.reduce((a, b) => a + b, 0) / n;

    // وزن الاتجاه
    let trendWeight = 0;
    for (let i = 1; i < n; i++) {
      trendWeight += (consumptions[i] - consumptions[i - 1]) / consumptions[i - 1];
    }
    trendWeight = trendWeight / (n - 1);

    // وزن الموسمية
    const seasonalWeight = this.calculateSeasonality(data);

    // وزن درجة الحرارة
    const tempWeight = this.calculateTemperatureCorrelation(data);

    return [1, trendWeight, seasonalWeight, tempWeight, 0.1];
  }

  /**
   * حساب الموسمية
   */
  private calculateSeasonality(data: ConsumptionData[]): number {
    if (data.length < 7) return 0;

    const weeklyAvg = new Array(7).fill(0);
    const counts = new Array(7).fill(0);

    for (const d of data) {
      const day = new Date(d.timestamp).getDay();
      weeklyAvg[day] += d.consumption;
      counts[day]++;
    }

    for (let i = 0; i < 7; i++) {
      weeklyAvg[i] = counts[i] > 0 ? weeklyAvg[i] / counts[i] : 0;
    }

    const overallMean = weeklyAvg.reduce((a, b) => a + b, 0) / 7;
    const variance = weeklyAvg.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) / 7;

    return Math.sqrt(variance) / overallMean;
  }

  /**
   * حساب ارتباط درجة الحرارة
   */
  private calculateTemperatureCorrelation(data: ConsumptionData[]): number {
    const withTemp = data.filter(d => d.temperature !== undefined);
    if (withTemp.length < 10) return 0;

    const consumptions = withTemp.map(d => d.consumption);
    const temperatures = withTemp.map(d => d.temperature!);

    const n = withTemp.length;
    const meanC = consumptions.reduce((a, b) => a + b, 0) / n;
    const meanT = temperatures.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomC = 0;
    let denomT = 0;

    for (let i = 0; i < n; i++) {
      const diffC = consumptions[i] - meanC;
      const diffT = temperatures[i] - meanT;
      numerator += diffC * diffT;
      denomC += diffC * diffC;
      denomT += diffT * diffT;
    }

    const denom = Math.sqrt(denomC * denomT);
    return denom > 0 ? numerator / denom : 0;
  }

  /**
   * الحصول على تنبؤ من AI
   */
  private async getAIPrediction(
    historicalData: ConsumptionData[],
    horizonDays: number,
  ): Promise<{ predictions: number[]; confidence: number }> {
    const recentData = historicalData.slice(-30); // آخر 30 سجل

    const prompt = `Based on the following electricity consumption data (in kWh), predict the consumption for the next ${horizonDays} days.

Historical Data (last 30 readings):
${recentData.map(d => `Date: ${d.timestamp}, Consumption: ${d.consumption} kWh`).join('\n')}

Provide predictions in JSON format:
{
  "predictions": [array of ${horizonDays} predicted values],
  "confidence": confidence level between 0 and 1,
  "reasoning": "brief explanation"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in electricity consumption forecasting. Analyze patterns and provide accurate predictions.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return {
        predictions: result.predictions || [],
        confidence: result.confidence || 0.8,
      };
    } catch (error) {
      this.logger.warn(`AI prediction failed, using statistical fallback: ${error}`);
      return { predictions: [], confidence: 0.5 };
    }
  }

  /**
   * توليد التنبؤات
   */
  private generatePredictions(
    historicalData: ConsumptionData[],
    horizonDays: number,
    aiPrediction: { predictions: number[]; confidence: number },
    stats: ReturnType<typeof this.calculateStatistics>,
  ): ForecastResult['predictions'] {
    const predictions: ForecastResult['predictions'] = [];
    const lastDate = new Date(historicalData[historicalData.length - 1].timestamp);

    for (let i = 0; i < horizonDays; i++) {
      const predictionDate = new Date(lastDate);
      predictionDate.setDate(predictionDate.getDate() + i + 1);

      const dayOfWeek = predictionDate.getDay();
      const weeklyFactor = stats.weeklyPattern[dayOfWeek] / stats.mean;

      // دمج التنبؤ الإحصائي مع AI
      let predictedConsumption: number;
      if (aiPrediction.predictions.length > i) {
        // وزن 60% لـ AI و 40% للإحصائي
        const aiValue = aiPrediction.predictions[i];
        const statValue = stats.mean * weeklyFactor;
        predictedConsumption = 0.6 * aiValue + 0.4 * statValue;
      } else {
        predictedConsumption = stats.mean * weeklyFactor;
      }

      // حساب حدود الثقة
      const uncertainty = stats.std * (1 + 0.1 * i); // زيادة عدم اليقين مع الوقت
      const confidence = Math.max(0.5, aiPrediction.confidence - 0.02 * i);

      predictions.push({
        timestamp: predictionDate,
        predictedConsumption: Math.round(predictedConsumption * 100) / 100,
        lowerBound: Math.round((predictedConsumption - 1.96 * uncertainty) * 100) / 100,
        upperBound: Math.round((predictedConsumption + 1.96 * uncertainty) * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    return predictions;
  }

  /**
   * تحليل الاتجاهات
   */
  private analyzeTrends(data: ConsumptionData[]): ForecastResult['trends'] {
    if (data.length < 7) {
      return {
        direction: 'stable',
        percentageChange: 0,
        seasonalPattern: 'insufficient data',
      };
    }

    const recentWeek = data.slice(-7);
    const previousWeek = data.slice(-14, -7);

    const recentAvg = recentWeek.reduce((sum, d) => sum + d.consumption, 0) / recentWeek.length;
    const previousAvg = previousWeek.length > 0
      ? previousWeek.reduce((sum, d) => sum + d.consumption, 0) / previousWeek.length
      : recentAvg;

    const percentageChange = ((recentAvg - previousAvg) / previousAvg) * 100;

    let direction: 'increasing' | 'decreasing' | 'stable';
    if (percentageChange > 5) {
      direction = 'increasing';
    } else if (percentageChange < -5) {
      direction = 'decreasing';
    } else {
      direction = 'stable';
    }

    // تحديد النمط الموسمي
    const seasonality = this.calculateSeasonality(data);
    let seasonalPattern: string;
    if (seasonality > 0.2) {
      seasonalPattern = 'strong weekly pattern';
    } else if (seasonality > 0.1) {
      seasonalPattern = 'moderate weekly pattern';
    } else {
      seasonalPattern = 'weak or no weekly pattern';
    }

    return {
      direction,
      percentageChange: Math.round(percentageChange * 100) / 100,
      seasonalPattern,
    };
  }

  /**
   * توليد الرؤى
   */
  private async generateInsights(
    historicalData: ConsumptionData[],
    predictions: ForecastResult['predictions'],
    trends: ForecastResult['trends'],
  ): Promise<string[]> {
    const insights: string[] = [];

    // رؤية الاتجاه
    if (trends.direction === 'increasing') {
      insights.push(`الاستهلاك في ازدياد بنسبة ${Math.abs(trends.percentageChange).toFixed(1)}% مقارنة بالأسبوع السابق`);
    } else if (trends.direction === 'decreasing') {
      insights.push(`الاستهلاك في انخفاض بنسبة ${Math.abs(trends.percentageChange).toFixed(1)}% مقارنة بالأسبوع السابق`);
    }

    // رؤية الذروة
    const maxPrediction = predictions.reduce((max, p) => 
      p.predictedConsumption > max.predictedConsumption ? p : max
    );
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    insights.push(`أعلى استهلاك متوقع يوم ${dayNames[new Date(maxPrediction.timestamp).getDay()]} (${maxPrediction.predictedConsumption.toFixed(1)} كيلوواط/ساعة)`);

    // رؤية النمط الموسمي
    insights.push(`النمط الموسمي: ${trends.seasonalPattern === 'strong weekly pattern' ? 'نمط أسبوعي قوي' : 
      trends.seasonalPattern === 'moderate weekly pattern' ? 'نمط أسبوعي متوسط' : 'نمط ضعيف أو غير موجود'}`);

    // رؤية الثقة
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    if (avgConfidence > 0.8) {
      insights.push('مستوى الثقة في التنبؤات: مرتفع');
    } else if (avgConfidence > 0.6) {
      insights.push('مستوى الثقة في التنبؤات: متوسط');
    } else {
      insights.push('مستوى الثقة في التنبؤات: منخفض - يُنصح بمراجعة البيانات');
    }

    return insights;
  }

  /**
   * حساب MAPE
   */
  private calculateMAPE(data: ConsumptionData[]): number {
    if (data.length < 2) return 0;

    const stats = this.calculateStatistics(data);
    let totalError = 0;
    let count = 0;

    for (const d of data) {
      const dayOfWeek = new Date(d.timestamp).getDay();
      const predicted = stats.weeklyPattern[dayOfWeek];
      if (d.consumption > 0) {
        totalError += Math.abs((d.consumption - predicted) / d.consumption);
        count++;
      }
    }

    return count > 0 ? (totalError / count) * 100 : 0;
  }

  /**
   * حساب RMSE
   */
  private calculateRMSE(data: ConsumptionData[]): number {
    if (data.length < 2) return 0;

    const stats = this.calculateStatistics(data);
    let sumSquaredError = 0;

    for (const d of data) {
      const dayOfWeek = new Date(d.timestamp).getDay();
      const predicted = stats.weeklyPattern[dayOfWeek];
      sumSquaredError += Math.pow(d.consumption - predicted, 2);
    }

    return Math.sqrt(sumSquaredError / data.length);
  }

  /**
   * حساب R²
   */
  private calculateR2(data: ConsumptionData[]): number {
    if (data.length < 2) return 0;

    const stats = this.calculateStatistics(data);
    let ssRes = 0;
    let ssTot = 0;

    for (const d of data) {
      const dayOfWeek = new Date(d.timestamp).getDay();
      const predicted = stats.weeklyPattern[dayOfWeek];
      ssRes += Math.pow(d.consumption - predicted, 2);
      ssTot += Math.pow(d.consumption - stats.mean, 2);
    }

    return ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  }

  /**
   * تسجيل التدريب
   */
  private async logTraining(modelType: string, metrics: Record<string, number>): Promise<void> {
    try {
      // البحث عن النموذج الموجود
      const existingModel = await this.prisma.devAiModel.findFirst({
        where: { name: modelType },
      });

      if (existingModel) {
        // تحديث النموذج الموجود
        await this.prisma.devAiModel.update({
          where: { id: existingModel.id },
          data: {
            metrics: metrics as any,
            lastTrainedAt: new Date(),
          },
        });
      } else {
        // إنشاء نموذج جديد
        await this.prisma.devAiModel.create({
          data: {
            name: modelType,
            type: 'prediction',
            version: '1.0.0',
            config: {},
            metrics: metrics as any,
            status: 'active',
            lastTrainedAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to log training: ${error}`);
    }
  }
}
