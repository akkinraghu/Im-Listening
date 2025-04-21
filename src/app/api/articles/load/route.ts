import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Article from '@/models/Article';
import ArticleChunk from '@/models/ArticleChunk';

// Default number of articles to load
const DEFAULT_ARTICLE_COUNT = 10;

// Sample article sources for development
const SAMPLE_ARTICLE_SOURCES = [
  'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7094565/',
  'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6447167/',
  'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6447187/',
  'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6447159/',
  'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6447175/',
  'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6447161/',
  'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6447173/',
  'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6447165/',
  'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6447163/',
  'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6447169/',
];

/**
 * GET /api/articles/load
 * Load and process articles for the vector database
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const count = parseInt(searchParams.get('count') || DEFAULT_ARTICLE_COUNT.toString());
    const apiKey = searchParams.get('apiKey');
    
    // Simple API key validation for public endpoint security
    if (!apiKey || apiKey !== process.env.ARTICLE_LOAD_API_KEY) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    await connectToDatabase();
    
    // Check if we already have articles
    const existingCount = await Article.countDocuments();
    
    if (existingCount >= count) {
      return NextResponse.json({
        message: `Already have ${existingCount} articles, no new articles loaded`,
        articlesLoaded: 0,
        totalArticles: existingCount
      });
    }
    
    // Determine how many more articles to load
    const articlesToLoad = Math.min(count - existingCount, SAMPLE_ARTICLE_SOURCES.length);
    
    // Load and process articles
    const results = await Promise.all(
      SAMPLE_ARTICLE_SOURCES.slice(0, articlesToLoad).map(async (url, index) => {
        try {
          // Fetch article content
          const article = await fetchArticleContent(url);
          
          // Save article to database
          const savedArticle = await Article.create({
            title: article.title,
            content: article.content,
            source: article.source,
            url: article.url,
            author: article.author,
            publishedDate: article.publishedDate
          });
          
          // Chunk the article content
          const chunks = chunkArticleContent(article.content);
          
          // Generate embeddings and save chunks
          await Promise.all(chunks.map(async (chunk, chunkIndex) => {
            // Generate embedding for chunk
            const embedding = await generateEmbedding(chunk);
            
            // Save chunk with embedding
            await ArticleChunk.create({
              articleId: savedArticle._id,
              content: chunk,
              chunkIndex,
              embedding
            });
          }));
          
          return {
            articleId: savedArticle._id,
            title: article.title,
            chunksCount: chunks.length,
            success: true
          };
        } catch (error) {
          console.error(`Error processing article ${url}:`, error);
          return {
            url,
            success: false,
            error: (error as Error).message
          };
        }
      })
    );
    
    // Count successful articles
    const successfulArticles = results.filter(result => result.success).length;
    
    return NextResponse.json({
      message: `Successfully loaded ${successfulArticles} articles`,
      articlesLoaded: successfulArticles,
      totalArticles: existingCount + successfulArticles,
      results
    });
  } catch (error) {
    console.error('Error loading articles:', error);
    return NextResponse.json(
      { error: 'Failed to load articles' },
      { status: 500 }
    );
  }
}

/**
 * Fetch article content from a URL
 */
async function fetchArticleContent(url: string) {
  // For development, we'll use mock data
  // In production, this would fetch actual content from URLs
  
  const randomTitle = [
    'Advances in Medical Research',
    'Understanding Cognitive Development',
    'The Future of AI in Healthcare',
    'Climate Change Impact on Public Health',
    'Nutrition and Mental Health',
    'Emerging Infectious Diseases',
    'Genomic Medicine Applications',
    'Pediatric Care Best Practices',
    'Cardiovascular Health Innovations',
    'Neurological Disorders Research'
  ][Math.floor(Math.random() * 10)];
  
  const randomAuthor = [
    'Dr. Sarah Johnson',
    'Prof. Michael Chen',
    'Dr. Emily Rodriguez',
    'Prof. David Kim',
    'Dr. Lisa Patel',
    'Prof. Robert Williams',
    'Dr. James Thompson',
    'Prof. Maria Garcia',
    'Dr. Thomas Wilson',
    'Prof. Jennifer Lee'
  ][Math.floor(Math.random() * 10)];
  
  // Generate a random date within the last 3 years
  const randomDate = new Date();
  randomDate.setFullYear(randomDate.getFullYear() - Math.floor(Math.random() * 3));
  randomDate.setMonth(Math.floor(Math.random() * 12));
  randomDate.setDate(Math.floor(Math.random() * 28) + 1);
  
  // Generate mock content with medical terminology
  const paragraphs = [];
  const paragraphCount = 5 + Math.floor(Math.random() * 10);
  
  for (let i = 0; i < paragraphCount; i++) {
    const sentenceCount = 3 + Math.floor(Math.random() * 5);
    const sentences = [];
    
    for (let j = 0; j < sentenceCount; j++) {
      const medicalTerms = [
        'clinical trials', 'patient outcomes', 'treatment protocols',
        'diagnostic criteria', 'therapeutic interventions', 'epidemiological studies',
        'pathophysiology', 'pharmacokinetics', 'biomarkers', 'genomic sequencing',
        'immunotherapy', 'comorbidities', 'neuroplasticity', 'cardiovascular',
        'metabolic syndrome', 'inflammatory response', 'cognitive function'
      ];
      
      const term1 = medicalTerms[Math.floor(Math.random() * medicalTerms.length)];
      const term2 = medicalTerms[Math.floor(Math.random() * medicalTerms.length)];
      
      sentences.push(`The study examined ${term1} in relation to ${term2}.`);
    }
    
    paragraphs.push(sentences.join(' '));
  }
  
  return {
    title: randomTitle,
    content: paragraphs.join('\n\n'),
    source: 'PubMed Central',
    url,
    author: randomAuthor,
    publishedDate: randomDate.toISOString()
  };
}

/**
 * Chunk article content into smaller pieces
 */
function chunkArticleContent(content: string, maxChunkSize: number = 1000): string[] {
  // Split by paragraphs
  const paragraphs = content.split('\n\n');
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed max size, start a new chunk
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    // If a single paragraph is too large, split it by sentences
    if (paragraph.length > maxChunkSize) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [];
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        currentChunk += sentence + ' ';
      }
    } else {
      currentChunk += paragraph + '\n\n';
    }
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Generate embedding for a text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key is missing');
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    
    // Return a mock embedding for development/fallback
    return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  }
}
