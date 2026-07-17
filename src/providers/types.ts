export interface ProviderConfig {
  displayName: string;
  baseURL: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  temperature: number;
  maxOutputTokens: number;
}

export interface ProviderValidation {
  valid: boolean;
  errors: string[];
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  durationMs: number;
}

export interface ClassificationRerankRequest {
  item: {
    title: string;
    abstractNote?: string;
    creators: string[];
    date?: string;
    publicationTitle?: string;
  };
  collections: Array<{
    collectionKey: string;
    path: string;
    localScore: number;
  }>;
  tags: Array<{ tag: string; localScore: number }>;
  similarItems: Array<{ title: string; abstractNote?: string }>;
}

export interface ClassificationRerankResponse {
  collections: Array<{
    collectionKey: string;
    confidence: number;
    reason: string;
  }>;
  tags: Array<{ tag: string; confidence: number; reason: string }>;
}

export interface LLMProvider {
  id: string;
  validateConfig(): Promise<ProviderValidation>;
  testConnection(signal?: AbortSignal): Promise<ProviderTestResult>;
  rerankClassification(
    request: ClassificationRerankRequest,
    signal?: AbortSignal,
  ): Promise<ClassificationRerankResponse>;
}
