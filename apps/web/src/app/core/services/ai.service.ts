import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface AnalysisResult {
  type: string;
  summary: string;
  insights: string[];
  recommendations: string[];
  confidence: number;
  metadata: any;
}

export interface PredictionResult {
  predictions: any[];
  confidence: number;
  model: string;
  metadata: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  response: string;
  tokensUsed: number;
  model: string;
}

export interface ExtractionResult {
  entities: any[];
  relationships: any[];
  metadata: any;
}

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  aspects?: any[];
}

export interface ClassificationResult {
  category: string;
  confidence: number;
  allCategories: { category: string; confidence: number }[];
}

export interface AiUsageStats {
  totalRequests: number;
  totalTokens: number;
  byModel: Record<string, { requests: number; tokens: number }>;
  byEndpoint: Record<string, number>;
}

export interface AnalyzeDto {
  data: any;
  type: string;
  options?: any;
}

export interface PredictDto {
  data: any;
  model?: string;
  horizon?: number;
  options?: any;
}

export interface ChatDto {
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ExtractDto {
  text: string;
  entityTypes?: string[];
  options?: any;
}

export interface SentimentDto {
  text: string;
  language?: string;
  aspects?: string[];
}

export interface ClassifyDto {
  text: string;
  categories: string[];
  multiLabel?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private readonly api = inject(ApiService);

  analyze(data: AnalyzeDto): Observable<AnalysisResult> {
    return this.api.post<AnalysisResult>('/ai/analyze', data);
  }

  predict(data: PredictDto): Observable<PredictionResult> {
    return this.api.post<PredictionResult>('/ai/predict', data);
  }

  chat(data: ChatDto): Observable<ChatResponse> {
    return this.api.post<ChatResponse>('/ai/chat', data);
  }

  extract(data: ExtractDto): Observable<ExtractionResult> {
    return this.api.post<ExtractionResult>('/ai/extract', data);
  }

  sentiment(data: SentimentDto): Observable<SentimentResult> {
    return this.api.post<SentimentResult>('/ai/sentiment', data);
  }

  classify(data: ClassifyDto): Observable<ClassificationResult> {
    return this.api.post<ClassificationResult>('/ai/classify', data);
  }

  getUsage(): Observable<AiUsageStats> {
    return this.api.get<AiUsageStats>('/ai/usage');
  }
}
