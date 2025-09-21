export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    lessonId?: string;
    contentId?: string;
    chunkIndex: number;
    source: string;
    title?: string;
  };
  embedding?: number[];
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  lessonInfo?: {
    id: string;
    title: string;
    unitTitle: string;
    subjectName: string;
  };
}

export interface RAGContext {
  query: string;
  relevantChunks: SearchResult[];
  lessonContext?: any;
  userContext?: any;
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  confidence: number;
}