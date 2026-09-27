export type ExtractionAiUsage = {
  state: 'completed' | 'failed';
  costUsd: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  responseId: string | null;
};

export type ExtractionUsageObserver = {
  onStart(modelId: string): Promise<void>;
  onFinish(usage: ExtractionAiUsage): Promise<void>;
};
