export type SourceType = 'data_pack' | 'sensor' | 'calculation' | 'user_input' | 'external_realtime' | 'ai';

export type Confidence = 'alta' | 'media' | 'baja';

export type Evidence = {
  sourceType: SourceType;
  sourceId?: string;
  generatedAtIso: string;
  confidence: Confidence;
  simulated?: boolean;
};
