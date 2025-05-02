export interface VideoResource {
  title: string;
  platform: string;
  creator: string;
  url: string;
  thumbnail?: string;
  verified?: boolean;
}

export interface ArticleResource {
  title: string;
  publisher: string;
  url: string;
  snippet?: string;
}

export interface BookResource {
  title: string;
  author: string;
  year: string;
}

export interface TopicResource {
  topic: string;
  description: string;
  videos: VideoResource[];
  articles: ArticleResource[];
  book?: BookResource;
}

export interface SummaryResponse {
  summary: string;
  topics: string[];
  topicResources: TopicResource[];
}
