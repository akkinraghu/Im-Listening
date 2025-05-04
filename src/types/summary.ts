export interface VideoResource {
  title: string;
  platform?: string;
  creator?: string;
  url: string;
  thumbnail?: string;
}

export interface ArticleResource {
  title: string;
  url: string;
  snippet?: string;
}

export interface Resources {
  articles: ArticleResource[];
  videos: VideoResource[];
}

export interface RelatedArticle {
  id: number | string;
  title: string;
  url?: string;
  source?: string;
  snippet?: string;
  similarity?: number;
}

export interface SummaryResponse {
  summary: string;
  topics: string[];
  keyPoints: string;
  sampleQuestions: string;
  relatedArticles: RelatedArticle[];
  additionalResources: any[];
  resources: Resources;
}
