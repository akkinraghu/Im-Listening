/**
 * PMC Article Update Script for PostgreSQL
 *
 * This script fetches new or updated articles from PubMed Central using the OAI-PMH service,
 * processes them, and updates the PostgreSQL database with pgvector.
 *
 * It keeps track of the last update time to only fetch new articles in subsequent runs.
 */

// Import dependencies
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import { Pool } from 'pg';
import pgvector from 'pgvector/pg';
import OpenAI from 'openai';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const STATE_FILE = path.join(__dirname, 'pmc-update-state.json');
const PMC_OAI_URL = 'https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi';
const MAX_ARTICLES = 1000; // Maximum number of articles to process
const CHUNK_SIZE = 1000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Characters of overlap between chunks

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Register pgvector with pg
pgvector.registerType({ pg: Pool });

// Get PostgreSQL URI from environment or use fallback
const POSTGRES_URI = process.env.POSTGRES_URI || 'postgres://postgres:example@postgres:5432/im_listening';

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: POSTGRES_URI,
});

// Connect to PostgreSQL
async function connectToDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      console.log('Connected to PostgreSQL:', result.rows[0].now);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error connecting to PostgreSQL:', error);
    throw error;
  }
}

// Types for the state and article metadata
interface State {
  lastUpdateDate: string | null;
  totalArticlesProcessed: number;
  articlesLimit: number;
}

interface ArticleMetadata {
  pmcid: string;
  title: string;
  source: string;
  author: string;
  publishedDate: Date | null;
  url: string | null;
}

// Initialize state
let state: State = {
  lastUpdateDate: null, // Will be in format YYYY-MM-DD
  totalArticlesProcessed: 0,
  articlesLimit: MAX_ARTICLES
};

// Load state from file if it exists
function loadState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const stateData = fs.readFileSync(STATE_FILE, 'utf8');
      const loadedState = JSON.parse(stateData);
      
      // If we have a valid last update date, use it
      if (loadedState.lastUpdateDate) {
        state.lastUpdateDate = loadedState.lastUpdateDate;
        console.log(`Resuming from last update date: ${state.lastUpdateDate}`);
      } else {
        // Default to a fixed start date if no last update date is found
        state.lastUpdateDate = '2020-01-01';
        console.log(`No last update date found, starting from ${state.lastUpdateDate}`);
      }
      
      // Reset the counter for this run
      state.totalArticlesProcessed = 0;
      state.articlesLimit = loadedState.articlesLimit || MAX_ARTICLES;
    } else {
      // Default to a fixed start date if no state file exists
      state.lastUpdateDate = '2020-01-01';
      console.log(`No state file found, starting from ${state.lastUpdateDate}`);
    }
  } catch (error) {
    console.error('Error loading state:', error);
    // Default to a fixed start date if there's an error
    state.lastUpdateDate = '2020-01-01';
    console.log(`Error reading state file, starting from ${state.lastUpdateDate}`);
  }
}

// Save state to file
function saveState(): void {
  try {
    // Update the last update date to today
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const stateToSave = {
      ...state,
      lastUpdateDate: formattedDate
    };
    
    fs.writeFileSync(STATE_FILE, JSON.stringify(stateToSave, null, 2));
    console.log(`State saved with last update date: ${formattedDate}`);
    console.log(`Total articles processed in this run: ${state.totalArticlesProcessed}`);
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

// Fetch articles from PMC OAI-PMH service
async function fetchArticlesFromPMC(): Promise<void> {
  try {
    const fromDate = state.lastUpdateDate;
    console.log(`Fetching articles from PMC starting from ${fromDate}`);
    
    // Construct the OAI-PMH request URL
    const params = new URLSearchParams({
      verb: 'ListRecords',
      metadataPrefix: 'pmc',
      from: fromDate || '2020-01-01'
    });
    
    const url = `${PMC_OAI_URL}?${params.toString()}`;
    console.log(`Request URL: ${url}`);
    
    const response = await axios.get(url);
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);
    
    // Check if we have records
    if (result.OAI_PMH.ListRecords && result.OAI_PMH.ListRecords.record) {
      const records = Array.isArray(result.OAI_PMH.ListRecords.record) 
        ? result.OAI_PMH.ListRecords.record 
        : [result.OAI_PMH.ListRecords.record];
      
      console.log(`Found ${records.length} records in the first batch`);
      
      // Process this batch of records
      await processRecordsBatch(records);
      
      // Check if there's a resumption token for more records
      if (result.OAI_PMH.ListRecords.resumptionToken && 
          result.OAI_PMH.ListRecords.resumptionToken._ &&
          state.totalArticlesProcessed < state.articlesLimit) {
        const resumptionToken = result.OAI_PMH.ListRecords.resumptionToken._;
        console.log(`Found resumption token: ${resumptionToken}`);
        await fetchMoreRecordsWithToken(resumptionToken);
      } else {
        console.log('No more records to fetch or reached article limit');
      }
    } else {
      console.log('No records found in the response');
      
      // If no records found with the current date, try with an earlier date
      if (fromDate && fromDate !== '2020-01-01') {
        console.log('Trying with an earlier date');
        state.lastUpdateDate = '2020-01-01';
        await fetchArticlesFromPMC();
      }
    }
  } catch (error) {
    console.error('Error fetching articles from PMC:', error);
  }
}

// Process a batch of records
async function processRecordsBatch(records: any[]): Promise<void> {
  try {
    const articles: ArticleMetadata[] = [];
    
    for (const record of records) {
      try {
        // Extract metadata from the record
        const metadata = record.metadata?.article?.front;
        if (!metadata) {
          console.log('Skipping record with no metadata');
          continue;
        }
        
        // Extract PMCID
        const pmcid = record.header?.identifier?.replace('oai:pubmedcentral.nih.gov:', '');
        if (!pmcid) {
          console.log('Skipping record with no PMCID');
          continue;
        }
        
        // Extract title
        let title = '';
        if (metadata['journal-meta']?.['journal-title']) {
          title = metadata['journal-meta']['journal-title'];
        } else if (metadata['article-meta']?.['title-group']?.['article-title']) {
          title = extractTextFromNode(metadata['article-meta']['title-group']['article-title']);
        }
        
        if (!title) {
          console.log(`Skipping article ${pmcid} with no title`);
          continue;
        }
        
        // Extract source (journal name)
        let source = '';
        if (metadata['journal-meta']?.['journal-title']) {
          source = metadata['journal-meta']['journal-title'];
        }
        
        // Extract author
        let author = '';
        if (metadata['article-meta']?.['contrib-group']?.contrib) {
          const contribs = Array.isArray(metadata['article-meta']['contrib-group'].contrib) 
            ? metadata['article-meta']['contrib-group'].contrib 
            : [metadata['article-meta']['contrib-group'].contrib];
          
          const authors = contribs
            .filter((contrib: any) => contrib.$.contrib_type === 'author')
            .map((contrib: any) => {
              if (contrib.name) {
                const surname = contrib.name.surname || '';
                const givenNames = contrib.name['given-names'] || '';
                return `${surname}${givenNames ? ', ' + givenNames : ''}`;
              }
              return '';
            })
            .filter((name: string) => name);
          
          author = authors.join('; ');
        }
        
        // Extract publication date
        let publishedDate: Date | null = null;
        if (metadata['article-meta']?.['pub-date']) {
          const pubDates = Array.isArray(metadata['article-meta']['pub-date']) 
            ? metadata['article-meta']['pub-date'] 
            : [metadata['article-meta']['pub-date']];
          
          for (const pubDate of pubDates) {
            if (pubDate.year) {
              const year = pubDate.year;
              const month = pubDate.month || '01';
              const day = pubDate.day || '01';
              publishedDate = new Date(`${year}-${month}-${day}`);
              break;
            }
          }
        }
        
        // Construct URL
        const url = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`;
        
        // Add to articles array
        articles.push({
          pmcid,
          title,
          source,
          author,
          publishedDate,
          url
        });
        
      } catch (recordError) {
        console.error('Error processing record:', recordError);
      }
    }
    
    console.log(`Extracted metadata for ${articles.length} articles`);
    
    // Process and save the articles
    if (articles.length > 0) {
      await processArticles(articles);
    }
  } catch (error) {
    console.error('Error processing records batch:', error);
  }
}

// Fetch more records using a resumption token
async function fetchMoreRecordsWithToken(resumptionToken: string): Promise<void> {
  try {
    console.log(`Fetching more records with token: ${resumptionToken}`);
    
    // Construct the OAI-PMH request URL with resumption token
    const params = new URLSearchParams({
      verb: 'ListRecords',
      resumptionToken
    });
    
    const url = `${PMC_OAI_URL}?${params.toString()}`;
    
    const response = await axios.get(url);
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);
    
    // Check if we have records
    if (result.OAI_PMH.ListRecords && result.OAI_PMH.ListRecords.record) {
      const records = Array.isArray(result.OAI_PMH.ListRecords.record) 
        ? result.OAI_PMH.ListRecords.record 
        : [result.OAI_PMH.ListRecords.record];
      
      console.log(`Found ${records.length} records in this batch`);
      
      // Process this batch of records
      await processRecordsBatch(records);
      
      // Check if there's a resumption token for more records
      if (result.OAI_PMH.ListRecords.resumptionToken && 
          result.OAI_PMH.ListRecords.resumptionToken._ &&
          state.totalArticlesProcessed < state.articlesLimit) {
        const nextToken = result.OAI_PMH.ListRecords.resumptionToken._;
        console.log(`Found next resumption token: ${nextToken}`);
        await fetchMoreRecordsWithToken(nextToken);
      } else {
        console.log('No more records to fetch or reached article limit');
      }
    } else {
      console.log('No records found in the response');
    }
  } catch (error) {
    console.error('Error fetching more records with token:', error);
  }
}

// Process articles and save to database
async function processArticles(articles: ArticleMetadata[]): Promise<void> {
  try {
    console.log(`Processing ${articles.length} articles`);
    
    const client = await pool.connect();
    
    try {
      for (const article of articles) {
        // Check if we've reached the limit
        if (state.totalArticlesProcessed >= state.articlesLimit) {
          console.log(`Reached article limit of ${state.articlesLimit}`);
          break;
        }
        
        try {
          // Check if article already exists
          const existingArticle = await client.query(
            'SELECT id FROM articles WHERE url = $1',
            [article.url]
          );
          
          if (existingArticle.rows.length > 0) {
            console.log(`Article ${article.pmcid} already exists, skipping`);
            continue;
          }
          
          // Fetch the full article content
          console.log(`Fetching content for article ${article.pmcid}`);
          const content = await fetchArticleContent(article.pmcid);
          
          if (!content) {
            console.log(`No content found for article ${article.pmcid}, skipping`);
            continue;
          }
          
          // Insert the article into the database
          const result = await client.query(
            `INSERT INTO articles (title, content, source, url, author, published_date)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
              article.title,
              content,
              article.source,
              article.url,
              article.author,
              article.publishedDate
            ]
          );
          
          const articleId = result.rows[0].id;
          console.log(`Saved article ${article.pmcid} with ID ${articleId}`);
          
          // Create chunks for the article
          await createChunksForArticle(client, articleId, content);
          
          // Increment the counter
          state.totalArticlesProcessed++;
          console.log(`Processed ${state.totalArticlesProcessed}/${state.articlesLimit} articles`);
        } catch (articleError) {
          console.error(`Error processing article ${article.pmcid}:`, articleError);
        }
      }
    } finally {
      client.release();
    }
    
    console.log(`Finished processing ${articles.length} articles`);
  } catch (error) {
    console.error('Error processing articles:', error);
  }
}

// Fetch the full article content from PMC
async function fetchArticleContent(pmcid: string): Promise<string | null> {
  try {
    // Construct the URL for the article XML
    const url = `https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:${pmcid}&metadataPrefix=pmc`;
    
    const response = await axios.get(url);
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);
    
    // Extract the article text from the XML
    if (result.OAI_PMH?.GetRecord?.record?.metadata?.article) {
      const article = result.OAI_PMH.GetRecord.record.metadata.article;
      
      // Extract title
      let title = '';
      if (article.front?.['article-meta']?.['title-group']?.['article-title']) {
        title = extractTextFromNode(article.front['article-meta']['title-group']['article-title']);
      }
      
      // Extract abstract
      let abstract = '';
      if (article.front?.['article-meta']?.abstract) {
        abstract = extractTextFromNode(article.front['article-meta'].abstract);
      }
      
      // Extract body
      let body = '';
      if (article.body) {
        body = extractTextFromNode(article.body);
      }
      
      // Combine the parts
      const content = `${title}\n\n${abstract}\n\n${body}`;
      return content;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching content for article ${pmcid}:`, error);
    return null;
  }
}

// Helper function to extract text from XML nodes
function extractTextFromNode(node: any): string {
  if (!node) {
    return '';
  }
  
  if (typeof node === 'string') {
    return node;
  }
  
  if (node._) {
    return node._;
  }
  
  let text = '';
  
  // Handle arrays
  if (Array.isArray(node)) {
    for (const item of node) {
      text += ' ' + extractTextFromNode(item);
    }
    return text.trim();
  }
  
  // Handle objects
  if (typeof node === 'object') {
    for (const key in node) {
      if (key !== '$') { // Skip attributes
        text += ' ' + extractTextFromNode(node[key]);
      }
    }
    return text.trim();
  }
  
  return '';
}

// Create chunks for an article and generate embeddings
async function createChunksForArticle(client: any, articleId: number, content: string): Promise<void> {
  try {
    console.log(`Creating chunks for article ${articleId}`);
    
    // Split the content into chunks
    const chunks: string[] = [];
    let startIndex = 0;
    
    while (startIndex < content.length) {
      const endIndex = Math.min(startIndex + CHUNK_SIZE, content.length);
      chunks.push(content.substring(startIndex, endIndex));
      startIndex = endIndex - CHUNK_OVERLAP; // Overlap with previous chunk
      
      // Avoid creating tiny chunks at the end
      if (endIndex === content.length) {
        break;
      }
    }
    
    console.log(`Created ${chunks.length} chunks for article ${articleId}`);
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding for the chunk
      const embedding = await generateEmbeddings(chunk);
      
      // Insert the chunk into the database
      await client.query(
        `INSERT INTO article_chunks (article_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4)`,
        [articleId, i, chunk, embedding]
      );
      
      console.log(`Saved chunk ${i + 1}/${chunks.length} for article ${articleId}`);
    }
    
    console.log(`Finished creating chunks for article ${articleId}`);
  } catch (error) {
    console.error(`Error creating chunks for article ${articleId}:`, error);
  }
}

// Generate embeddings for a given text
async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    // Use OpenAI to generate embeddings
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Return a zero vector as fallback
    return Array(1536).fill(0);
  }
}

// Main function
async function main(): Promise<void> {
  try {
    console.log('Starting PMC article update process');
    
    // Load state from file
    loadState();
    
    // Connect to the database
    await connectToDatabase();
    
    // Fetch and process articles
    await fetchArticlesFromPMC();
    
    // Save state to file
    saveState();
    
    console.log('PMC article update process completed successfully');
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    // Close database connection
    await pool.end();
    console.log('Database connection closed');
  }
}

// Export the main function for use in scheduler
export { main };

// Run the main function if this script is executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('Script execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}
