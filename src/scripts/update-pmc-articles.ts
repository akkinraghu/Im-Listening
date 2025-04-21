/**
 * PMC Article Update Script
 *
 * This script fetches new or updated articles from PubMed Central using the OAI-PMH service,
 * processes them, and updates the vector database.
 *
 * It keeps track of the last update time to only fetch new articles in subsequent runs.
 */

// Import dependencies
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const STATE_FILE = path.join(__dirname, 'pmc-update-state.json');
const PMC_OAI_URL = 'https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi';
const MAX_ARTICLES = 1000; // Maximum number of articles to process
const CHUNK_SIZE = 1000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Characters of overlap between chunks

// Get MongoDB URI from environment or use fallback
// Handle both standard and SRV connection formats
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://root:example@localhost:27017/im_listening?authSource=admin';

// Connect to MongoDB
async function connectToDatabase(): Promise<void> {
  try {
    // Check if we're using mongodb+srv protocol
    if (MONGODB_URI.startsWith('mongodb+srv://')) {
      // For SRV records, we cannot specify a port
      await mongoose.connect(MONGODB_URI);
    } else {
      // For standard MongoDB connections
      await mongoose.connect(MONGODB_URI);
    }
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

// Define the Article model
const articleSchema = new mongoose.Schema({
  title: String,
  content: String,
  source: String,
  url: String,
  author: String,
  publishedDate: Date,
});

const Article = mongoose.model('Article', articleSchema);

// Define the ArticleChunk model
const articleChunkSchema = new mongoose.Schema({
  content: String,
  embedding: String,
  articleId: mongoose.Schema.Types.ObjectId,
  chunkIndex: Number, // Add the chunk index to the schema
});

const ArticleChunk = mongoose.model('ArticleChunk', articleChunkSchema);

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
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      state = JSON.parse(data);
      console.log(`Loaded state: Last update was on ${state.lastUpdateDate}`);
      
      // Ensure the articlesLimit property exists
      if (!state.articlesLimit) {
        state.articlesLimit = MAX_ARTICLES;
      }
    } else {
      // Use a fixed date from the past to ensure we get articles
      state.lastUpdateDate = '2020-01-01';
      console.log(`No state file found. Using default date: ${state.lastUpdateDate}`);
    }
  } catch (error) {
    console.error('Error loading state:', error);
    // Set a default date in case of error
    state.lastUpdateDate = '2020-01-01';
    console.log(`Error loading state. Using default date: ${state.lastUpdateDate}`);
  }
}

// Save state to file
function saveState(): void {
  try {
    // Don't save a future date as the last update date
    const today = new Date();
    
    // Only convert to Date if lastUpdateDate is not null
    if (state.lastUpdateDate) {
      const lastUpdateDate = new Date(state.lastUpdateDate);
      
      // If the last update date is in the future, use today's date
      if (lastUpdateDate > today) {
        state.lastUpdateDate = today.toISOString().split('T')[0];
        console.log(`Adjusted future date to today: ${state.lastUpdateDate}`);
      }
    } else {
      // If lastUpdateDate is null, set it to today
      state.lastUpdateDate = today.toISOString().split('T')[0];
    }

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`Saved state: Last update set to ${state.lastUpdateDate}`);
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

// Fetch articles from PMC OAI-PMH service
async function fetchArticlesFromPMC(): Promise<void> {
  try {
    console.log(`Fetching articles updated since ${state.lastUpdateDate}...`);
    const params = new URLSearchParams({
      verb: 'ListRecords',
      metadataPrefix: 'pmc',
      from: state.lastUpdateDate || '2020-01-01',
    });
    const url = `${PMC_OAI_URL}?${params.toString()}`;
    console.log(`Request URL: ${url}`);
    
    const response = await axios.get(url);
    
    // Print the first 500 characters of the response for debugging
    console.log(`Raw response data (first 500 chars): ${response.data.substring(0, 500)}`);
    
    // Parse the XML response
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);
    
    // Debug the response structure in more detail
    console.log(`Response structure: ${Object.keys(result)}`);
    console.log(`Raw result (first 1000 chars): ${JSON.stringify(result).substring(0, 1000)}`);
    
    // Check if we have an error response
    if (result['OAI-PMH'] && result['OAI-PMH'].error) {
      console.log('OAI-PMH Error:', JSON.stringify(result['OAI-PMH'].error, null, 2));
      return;
    }
    
    // Check if we have records
    if (!result['OAI-PMH'] || !result['OAI-PMH'].ListRecords || !result['OAI-PMH'].ListRecords.record) {
      console.log('No records found or unexpected response format');
      return;
    }
    
    // Get the records array (handle both array and single record cases)
    const records = Array.isArray(result['OAI-PMH'].ListRecords.record) 
      ? result['OAI-PMH'].ListRecords.record 
      : [result['OAI-PMH'].ListRecords.record];
    
    console.log(`Found ${records.length} records`);
    
    // Process records in batches
    await processRecordsBatch(records);
    
    // Check for resumption token to fetch more records
    if (result['OAI-PMH'] && result['OAI-PMH'].ListRecords && result['OAI-PMH'].ListRecords.resumptionToken) {
      const resumptionToken = result['OAI-PMH'].ListRecords.resumptionToken;
      if (typeof resumptionToken === 'string') {
        console.log(`Found resumption token: ${resumptionToken}`);
        await fetchMoreRecordsWithToken(resumptionToken);
      } else if (resumptionToken._ && typeof resumptionToken._ === 'string') {
        console.log(`Found resumption token: ${resumptionToken._}`);
        await fetchMoreRecordsWithToken(resumptionToken._);
      } else {
        console.log('Resumption token found but in unexpected format:', resumptionToken);
      }
    }
    
  } catch (error) {
    console.error('Error fetching articles from PMC:', error);
    throw error;
  }
}

// Process a batch of records
async function processRecordsBatch(records: any[]): Promise<void> {
  try {
    // Check if we've reached the article limit
    if (state.totalArticlesProcessed >= state.articlesLimit) {
      console.log(`Reached article limit of ${state.articlesLimit}. Stopping processing.`);
      return;
    }

    console.log(`Processing batch of ${records.length} records`);
    
    const articles: ArticleMetadata[] = [];
    
    for (const record of records) {
      try {
        // Skip if we've reached the article limit
        if (state.totalArticlesProcessed >= state.articlesLimit) {
          console.log(`Reached article limit of ${state.articlesLimit} during batch processing. Stopping.`);
          break;
        }

        // Extract metadata from the record
        if (!record.metadata || !record.metadata['article']) {
          console.log('Record missing metadata or article field, skipping');
          continue;
        }
        
        // Extract the identifier (PMCID)
        const identifier = record.header.identifier;
        console.log(`Processing identifier: ${identifier}`);
        
        // Extract PMCID from the identifier (format: oai:pubmedcentral.nih.gov:XXXXXX)
        const pmcidMatch = identifier.match(/oai:pubmedcentral\.nih\.gov:(\d+)/);
        const pmcid = pmcidMatch ? pmcidMatch[1] : '';
        
        // Extract basic metadata from the article if available
        let title = `Article ${pmcid}`;
        let author = 'Unknown Author';
        let source = 'PubMed Central';
        let publishedDate = new Date();
        
        if (record.metadata && record.metadata.article) {
          const article = record.metadata.article;
          
          // Try to extract title
          if (article.front && article.front['article-meta'] && 
              article.front['article-meta']['title-group'] && 
              article.front['article-meta']['title-group']['article-title']) {
            const articleTitle = article.front['article-meta']['title-group']['article-title'];
            if (typeof articleTitle === 'string') {
              title = articleTitle;
            } else if (articleTitle._ && typeof articleTitle._ === 'string') {
              title = articleTitle._;
            } else if (Array.isArray(articleTitle)) {
              // Handle case where article title is an array
              title = articleTitle.map(part => 
                typeof part === 'string' ? part : (part._ || '')
              ).join(' ').trim();
            } else {
              title = JSON.stringify(articleTitle).substring(0, 255);
            }
          }
          
          // Try to extract author
          if (article.front && article.front['article-meta'] && 
              article.front['article-meta']['contrib-group'] && 
              article.front['article-meta']['contrib-group'].contrib) {
            const contribs = Array.isArray(article.front['article-meta']['contrib-group'].contrib) 
              ? article.front['article-meta']['contrib-group'].contrib 
              : [article.front['article-meta']['contrib-group'].contrib];
              
            const authorContrib = contribs.find((c: any) => c.$ && c.$['contrib-type'] === 'author');
            if (authorContrib && authorContrib.name) {
              const surname = authorContrib.name.surname || '';
              const givenNames = authorContrib.name['given-names'] || '';
              author = `${surname}${givenNames ? ', ' + givenNames : ''}`;
            } else if (contribs.length > 0 && contribs[0].name) {
              // Fallback to first contributor if no specific author found
              const surname = contribs[0].name.surname || '';
              const givenNames = contribs[0].name['given-names'] || '';
              author = `${surname}${givenNames ? ', ' + givenNames : ''}`;
            }
          }
          
          // Try to extract source/journal
          if (article.front && article.front['journal-meta']) {
            const journalMeta = article.front['journal-meta'];
            if (journalMeta['journal-title']) {
              source = journalMeta['journal-title'];
            } else if (journalMeta['journal-title-group'] && journalMeta['journal-title-group']['journal-title']) {
              source = journalMeta['journal-title-group']['journal-title'];
            }
          }
          
          // Try to extract published date
          if (article.front && article.front['article-meta'] && 
              article.front['article-meta']['pub-date']) {
            const pubDates = Array.isArray(article.front['article-meta']['pub-date']) 
              ? article.front['article-meta']['pub-date'] 
              : [article.front['article-meta']['pub-date']];
              
            // Find a pub date with year, month, day if possible
            const pubDate = pubDates.find((pd: any) => pd.year && (pd.month || pd.day));
            if (pubDate) {
              const year = pubDate.year;
              const month = pubDate.month ? parseInt(pubDate.month) - 1 : 0; // JS months are 0-indexed
              const day = pubDate.day || 1;
              publishedDate = new Date(year, month, day);
            } else if (pubDates.length > 0 && pubDates[0].year) {
              // Fallback to just the year if that's all we have
              publishedDate = new Date(pubDates[0].year, 0, 1);
            }
          }
        }
        
        // Create a basic article metadata object
        articles.push({
          pmcid,
          title,
          source,
          author,
          publishedDate,
          url: pmcid ? `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcid}/` : null
        } as ArticleMetadata);
      } catch (error) {
        console.error('Error extracting basic metadata:', error);
      }
    }
    
    console.log(`Successfully extracted basic metadata for ${articles.length} articles`);
    
    // Process articles and save to database
    await processArticles(articles);
  } catch (error) {
    console.error('Error processing records batch:', error);
  }
}

// Fetch more records using a resumption token
async function fetchMoreRecordsWithToken(resumptionToken: string): Promise<void> {
  try {
    const params = new URLSearchParams({
      verb: 'ListRecords',
      resumptionToken: resumptionToken,
    });
    const url = `${PMC_OAI_URL}?${params.toString()}`;
    console.log(`Fetching more records using resumption token: ${url}`);
    
    const response = await axios.get(url);
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);
    
    // Extract the records
    if (!result['OAI-PMH'] || !result['OAI-PMH'].ListRecords || !result['OAI-PMH'].ListRecords.record) {
      console.log('No more records found');
      return;
    }
    
    const records = Array.isArray(result['OAI-PMH'].ListRecords.record) 
      ? result['OAI-PMH'].ListRecords.record 
      : [result['OAI-PMH'].ListRecords.record];
    
    console.log(`Found ${records.length} more records`);
    
    // Process records in batches
    await processRecordsBatch(records);
    
    // Check for another resumption token to fetch even more records
    if (result['OAI-PMH'] && result['OAI-PMH'].ListRecords && result['OAI-PMH'].ListRecords.resumptionToken) {
      const nextResumptionToken = result['OAI-PMH'].ListRecords.resumptionToken;
      if (typeof nextResumptionToken === 'string') {
        console.log(`Found another resumption token: ${nextResumptionToken}`);
        await fetchMoreRecordsWithToken(nextResumptionToken);
      } else if (nextResumptionToken._ && typeof nextResumptionToken._ === 'string') {
        console.log(`Found another resumption token: ${nextResumptionToken._}`);
        await fetchMoreRecordsWithToken(nextResumptionToken._);
      } else {
        console.log('Resumption token found but in unexpected format:', nextResumptionToken);
      }
    }
  } catch (error) {
    console.error('Error fetching more records:', error);
    // Save the current state before exiting
    saveState();
  }
}

// Process articles and save to database
async function processArticles(articles: ArticleMetadata[]): Promise<void> {
  console.log('Connecting to MongoDB...');
  await connectToDatabase();
  console.log('Connected to MongoDB');
  
  let processed = 0;
  let skipped = 0;
  
  for (const articleMeta of articles) {
    try {
      // Skip articles without a PMCID
      if (!articleMeta.pmcid || !articleMeta.url) {
        console.log(`Skipping article with missing PMCID or URL: ${articleMeta.title}`);
        skipped++;
        continue;
      }
      
      // Check if article already exists in the database
      console.log(`Checking if article exists: ${articleMeta.pmcid}`);
      const existingArticle = await Article.findOne({ 
        $or: [
          { url: articleMeta.url }, 
          { title: articleMeta.title, author: articleMeta.author }
        ] 
      });
      
      if (existingArticle) {
        console.log(`Article already exists: ${articleMeta.pmcid} - ${articleMeta.title}`);
        skipped++;
        continue;
      }
      
      // Fetch the full article content from PMC
      console.log(`Fetching full content for article: ${articleMeta.pmcid}`);
      const content = await fetchArticleContent(articleMeta.pmcid);
      
      if (!content) {
        console.log(`No content found for article: ${articleMeta.pmcid}`);
        skipped++;
        continue;
      }
      
      // Create the article in the database
      console.log(`Creating article in database: ${articleMeta.pmcid} - ${articleMeta.title}`);
      const article = await Article.create({
        title: articleMeta.title,
        content: content,
        source: articleMeta.source,
        url: articleMeta.url,
        author: articleMeta.author,
        publishedDate: articleMeta.publishedDate
      });
      
      // Create chunks and generate embeddings
      console.log(`Creating chunks for article: ${articleMeta.pmcid}`);
      await createChunksForArticle(article);
      
      processed++;
      console.log(`Processed article ${processed}/${articles.length}: ${articleMeta.pmcid} - ${articleMeta.title}`);
    } catch (error) {
      console.error(`Error processing article ${articleMeta.pmcid}:`, error);
      skipped++;
    }
  }
  
  console.log(`Processed ${processed} articles, skipped ${skipped} articles`);
}

// Fetch the full article content from PMC
async function fetchArticleContent(pmcid: string): Promise<string | null> {
  try {
    const url = `https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:${pmcid}&metadataPrefix=pmc`;
    console.log(`Fetching article content from: ${url}`);
    
    const response = await axios.get(url);
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);
    
    if (!result['OAI-PMH'] || !result['OAI-PMH'].GetRecord || !result['OAI-PMH'].GetRecord.record || 
        !result['OAI-PMH'].GetRecord.record.metadata || !result['OAI-PMH'].GetRecord.record.metadata.article) {
      console.log('No article content found');
      return null;
    }
    
    const article = result['OAI-PMH'].GetRecord.record.metadata.article;
    
    // Extract the abstract
    let abstract = '';
    if (article.front && article.front['article-meta'] && article.front['article-meta'].abstract) {
      abstract = extractTextFromNode(article.front['article-meta'].abstract);
    }
    
    // Extract the body content
    let body = '';
    if (article.body) {
      body = extractTextFromNode(article.body);
    }
    
    return `${abstract}\n\n${body}`.trim();
  } catch (error) {
    console.error('Error fetching article content:', error);
    return null;
  }
}

// Helper function to extract text from XML nodes
function extractTextFromNode(node: any): string {
  if (!node) return '';
  
  if (typeof node === 'string') {
    return node;
  }
  
  if (node._) {
    return node._;
  }
  
  let text = '';
  
  // Process all properties of the node
  for (const key in node) {
    if (key === '$' || key === '_') continue; // Skip attributes and text content already processed
    
    const child = node[key];
    
    if (Array.isArray(child)) {
      // Process array of nodes
      for (const item of child) {
        text += extractTextFromNode(item) + ' ';
      }
    } else if (typeof child === 'object') {
      // Process object node
      text += extractTextFromNode(child) + ' ';
    } else if (typeof child === 'string') {
      // Process string node
      text += child + ' ';
    }
  }
  
  return text.trim();
}

// Create chunks for an article and generate embeddings
async function createChunksForArticle(article: any): Promise<void> {
  try {
    console.log(`Creating chunks for article: ${article.title}`);
    
    const content = article.content;
    if (!content || content.trim().length === 0) {
      console.log('Article has no content, skipping chunk creation');
      return;
    }
    
    // Create chunks with overlap
    const chunks: string[] = [];
    let startIndex = 0;
    
    while (startIndex < content.length) {
      const endIndex = Math.min(startIndex + CHUNK_SIZE, content.length);
      chunks.push(content.substring(startIndex, endIndex));
      
      // Move the start index for the next chunk, accounting for overlap
      startIndex = endIndex - CHUNK_OVERLAP;
      
      // If we're near the end and the remaining content is smaller than the overlap,
      // just break to avoid tiny chunks
      if (startIndex + CHUNK_OVERLAP >= content.length) {
        break;
      }
    }
    
    console.log(`Created ${chunks.length} chunks for article`);
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding for the chunk
      const embedding = await generateEmbeddings(chunk);
      
      // Create a new chunk document
      const articleChunk = new ArticleChunk({
        content: chunk,
        embedding: embedding,
        articleId: article._id,
        chunkIndex: i
      });
      
      // Save the chunk
      await articleChunk.save();
    }
    
    console.log(`Saved ${chunks.length} chunks with embeddings for article: ${article.title}`);
  } catch (error) {
    console.error('Error creating chunks for article:', error);
    throw error;
  }
}

// Generate embeddings for a given text
async function generateEmbeddings(text: string): Promise<string> {
  try {
    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OpenAI API key not found. Using dummy embedding.');
      return 'dummy-embedding';
    }

    // Make a request to OpenAI's embedding API
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        input: text,
        model: 'text-embedding-ada-002', // Or use a newer model if available
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Extract the embedding from the response
    if (response.data && response.data.data && response.data.data[0] && response.data.data[0].embedding) {
      // Convert the embedding array to a string for storage
      return JSON.stringify(response.data.data[0].embedding);
    } else {
      console.warn('Unexpected response format from OpenAI API:', response.data);
      return 'dummy-embedding';
    }
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Fall back to dummy embedding in case of error
    return 'dummy-embedding';
  }
}

// Main function
async function main(): Promise<void> {
  try {
    console.log('Starting PMC article update script');
    
    // Load state from file
    loadState();
    
    // Reset the total articles processed counter for this run
    state.totalArticlesProcessed = 0;
    
    // Connect to the database
    await connectToDatabase();
    
    // Fetch articles from PMC
    await fetchArticlesFromPMC();
    
    // Check if we reached our article limit
    if (state.totalArticlesProcessed < state.articlesLimit) {
      console.log(`Only found ${state.totalArticlesProcessed} articles. Extending search further back in time.`);
      
      // Extend search by going back another year
      const currentDate = new Date(state.lastUpdateDate || '');
      currentDate.setFullYear(currentDate.getFullYear() - 1);
      state.lastUpdateDate = currentDate.toISOString().split('T')[0];
      
      console.log(`Extended search to ${state.lastUpdateDate}`);
      
      // Try fetching more articles
      await fetchArticlesFromPMC();
    }
    
    // Update the state with today's date for next time
    const today = new Date();
    state.lastUpdateDate = today.toISOString().split('T')[0];
    
    // Save the state
    saveState();
    
    console.log(`PMC article update completed. Processed ${state.totalArticlesProcessed} articles.`);
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
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
