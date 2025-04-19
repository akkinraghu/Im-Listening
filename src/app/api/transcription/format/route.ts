import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache for formatted responses
interface CacheEntry {
  formattedText: string;
  timestamp: number;
}

const formatCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes cache TTL

// Generate a cache key from request parameters
function generateCacheKey(text: string, format: string, userType: string): string {
  // Use a hash of the text to avoid extremely long keys
  const textHash = text.split('').reduce((hash, char) => {
    return ((hash << 5) - hash) + char.charCodeAt(0) | 0;
  }, 0);
  
  return `${textHash}_${format}_${userType}`;
}

/**
 * POST /api/transcription/format
 * Format a transcription based on the specified format and user type
 */
export async function POST(req: NextRequest) {
  console.log('Format API called with request:', req.url);
  
  try {
    const body = await req.json();
    console.log('Request body:', body);
    
    const { text, format, userType } = body;
    
    if (!text) {
      console.log('Error: Transcription text is required');
      return NextResponse.json(
        { error: 'Transcription text is required' },
        { status: 400 }
      );
    }
    
    if (!format) {
      console.log('Error: Format is required');
      return NextResponse.json(
        { error: 'Format is required' },
        { status: 400 }
      );
    }
    
    // Check cache first
    const cacheKey = generateCacheKey(text, format, userType);
    const cachedResult = formatCache.get(cacheKey);
    const now = Date.now();
    
    if (cachedResult && (now - cachedResult.timestamp) < CACHE_TTL) {
      console.log('Cache hit! Returning cached formatted text');
      return NextResponse.json({
        formattedText: cachedResult.formattedText,
        originalText: text,
        format,
        fromCache: true
      });
    }
    
    console.log('Cache miss or expired. Generating new formatted text.');
    let formattedText = '';
    
    // Check if OpenAI API key is configured (standard API takes precedence)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const openaiModel = process.env.OPENAI_MODEL || 'gpt-4';
    
    console.log('OpenAI API Key available:', !!openaiApiKey);
    console.log('OpenAI Model:', openaiModel);
    
    // Fallback to Azure OpenAI if standard OpenAI is not configured
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    
    console.log('Azure OpenAI available:', !!(azureApiKey && azureEndpoint && azureDeploymentName));
    
    if (openaiApiKey) {
      // Use standard OpenAI API for formatting
      try {
        console.log('Attempting to format with OpenAI...');
        formattedText = await formatWithOpenAI(text, format, userType, openaiApiKey, openaiModel);
        console.log('OpenAI formatting successful');
      } catch (error) {
        console.error('Error with OpenAI formatting:', error);
        // Fall back to Azure OpenAI if available
        if (azureApiKey && azureEndpoint && azureDeploymentName) {
          try {
            console.log('Falling back to Azure OpenAI...');
            formattedText = await formatWithAzureOpenAI(text, format, userType);
            console.log('Azure OpenAI formatting successful');
          } catch (azureError) {
            console.error('Error with Azure OpenAI formatting:', azureError);
            console.log('Falling back to basic formatting rules...');
            formattedText = await formatWithBasicRules(text, format, userType);
          }
        } else {
          // Fall back to basic formatting if OpenAI fails and Azure is not available
          console.log('Falling back to basic formatting rules...');
          formattedText = await formatWithBasicRules(text, format, userType);
        }
      }
    } else if (azureApiKey && azureEndpoint && azureDeploymentName) {
      // Use Azure OpenAI if standard OpenAI is not configured
      try {
        console.log('Attempting to format with Azure OpenAI...');
        formattedText = await formatWithAzureOpenAI(text, format, userType);
        console.log('Azure OpenAI formatting successful');
      } catch (error) {
        console.error('Error with Azure OpenAI formatting:', error);
        // Fall back to basic formatting if Azure OpenAI fails
        console.log('Falling back to basic formatting rules...');
        formattedText = await formatWithBasicRules(text, format, userType);
      }
    } else {
      // Use basic formatting rules if neither OpenAI nor Azure OpenAI is configured
      console.log('No AI services configured, using basic formatting rules...');
      formattedText = await formatWithBasicRules(text, format, userType);
    }
    
    // Cache the result
    formatCache.set(cacheKey, {
      formattedText,
      timestamp: now
    });
    
    console.log('Formatting complete, returning response');
    return NextResponse.json({
      formattedText,
      originalText: text,
      format,
      fromCache: false
    });
  } catch (error) {
    console.error('Error formatting transcription:', error);
    return NextResponse.json(
      { error: 'Failed to format transcription' },
      { status: 500 }
    );
  }
}

/**
 * Format text using standard OpenAI API
 */
async function formatWithOpenAI(
  text: string, 
  format: string, 
  userType: string, 
  apiKey: string, 
  model: string
): Promise<string> {
  console.log(`Formatting with OpenAI model: ${model}`);
  
  if (!apiKey) {
    throw new Error('OpenAI API key is missing');
  }
  
  // Use a faster model for shorter texts
  const actualModel = text.length < 1000 ? 'gpt-3.5-turbo' : model;
  console.log(`Using model: ${actualModel} based on text length: ${text.length}`);
  
  // Limit the input text length for faster responses
  const maxInputLength = 4000;
  const trimmedText = text.length > maxInputLength 
    ? text.substring(0, maxInputLength) + "... (text truncated for faster processing)"
    : text;
  
  let systemPrompt = '';
  let userPrompt = '';
  
  // Customize the prompt based on the format and user type
  switch (format) {
    case 'SOAP':
      systemPrompt = 'You are a medical documentation assistant. Format the following transcription into a proper SOAP note (Subjective, Objective, Assessment, Plan). Use appropriate medical terminology and structure. Be concise.';
      userPrompt = `Please format this medical transcription into a SOAP note. The context is a ${userType} consultation:\n\n${trimmedText}`;
      break;
    case 'Clinical Summary':
      systemPrompt = 'You are a medical documentation assistant. Create a concise clinical summary from the following transcription. Include key findings, diagnoses, and recommendations. Be brief and to the point.';
      userPrompt = `Please create a clinical summary from this transcription. The context is a ${userType} consultation:\n\n${trimmedText}`;
      break;
    case 'Bullet Points':
      systemPrompt = 'You are a documentation assistant. Convert the following transcription into a well-organized bullet point list, grouping related information together. Be concise.';
      userPrompt = `Please convert this transcription into bullet points. The context is a ${userType} consultation:\n\n${trimmedText}`;
      break;
    case 'HTML':
      systemPrompt = 'You are a documentation assistant. Convert the following transcription into well-formatted HTML with appropriate headings, paragraphs, and lists. Use semantic HTML5 elements where appropriate. Be concise.';
      userPrompt = `Please convert this transcription into HTML format. The context is a ${userType} consultation:\n\n${trimmedText}`;
      break;
    case 'Markdown':
      systemPrompt = 'You are a documentation assistant. Convert the following transcription into well-formatted Markdown with appropriate headings, paragraphs, and lists. Be concise.';
      userPrompt = `Please convert this transcription into Markdown format. The context is a ${userType} consultation:\n\n${trimmedText}`;
      break;
    default:
      systemPrompt = 'You are a documentation assistant. Improve the formatting and clarity of the following transcription while preserving all information. Be concise.';
      userPrompt = `Please improve the formatting and clarity of this transcription. The context is a ${userType} consultation:\n\n${trimmedText}`;
  }
  
  console.log('Sending request to OpenAI API...');
  const startTime = Date.now();
  
  try {
    // Call OpenAI API with optimized parameters
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: actualModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more deterministic responses
        max_tokens: 1500, // Limit output tokens
        presence_penalty: 0,
        frequency_penalty: 0,
      }),
    });
    
    const endTime = Date.now();
    console.log(`OpenAI API response time: ${(endTime - startTime) / 1000} seconds`);
    console.log('OpenAI API response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    console.log('OpenAI API response received successfully');
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error in OpenAI API call:', error);
    throw error;
  }
}

/**
 * Format text using Azure OpenAI
 */
async function formatWithAzureOpenAI(text: string, format: string, userType: string): Promise<string> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  
  if (!apiKey || !endpoint || !deploymentName) {
    throw new Error('Azure OpenAI configuration is missing');
  }
  
  let systemPrompt = '';
  let userPrompt = '';
  
  // Customize the prompt based on the format and user type
  switch (format) {
    case 'SOAP':
      systemPrompt = 'You are a medical documentation assistant. Format the following transcription into a proper SOAP note (Subjective, Objective, Assessment, Plan). Use appropriate medical terminology and structure.';
      userPrompt = `Please format this medical transcription into a SOAP note. The context is a ${userType} consultation:\n\n${text}`;
      break;
    case 'Clinical Summary':
      systemPrompt = 'You are a medical documentation assistant. Create a concise clinical summary from the following transcription. Include key findings, diagnoses, and recommendations.';
      userPrompt = `Please create a clinical summary from this transcription. The context is a ${userType} consultation:\n\n${text}`;
      break;
    case 'Bullet Points':
      systemPrompt = 'You are a documentation assistant. Convert the following transcription into a well-organized bullet point list, grouping related information together.';
      userPrompt = `Please convert this transcription into bullet points. The context is a ${userType} consultation:\n\n${text}`;
      break;
    case 'HTML':
      systemPrompt = 'You are a documentation assistant. Convert the following transcription into well-formatted HTML with appropriate headings, paragraphs, and lists. Use semantic HTML5 elements where appropriate.';
      userPrompt = `Please convert this transcription into HTML format. The context is a ${userType} consultation:\n\n${text}`;
      break;
    case 'Markdown':
      systemPrompt = 'You are a documentation assistant. Convert the following transcription into well-formatted Markdown with appropriate headings, paragraphs, and lists.';
      userPrompt = `Please convert this transcription into Markdown format. The context is a ${userType} consultation:\n\n${text}`;
      break;
    default:
      systemPrompt = 'You are a documentation assistant. Improve the formatting and clarity of the following transcription while preserving all information.';
      userPrompt = `Please improve the formatting and clarity of this transcription. The context is a ${userType} consultation:\n\n${text}`;
  }
  
  // Call Azure OpenAI API
  const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2023-05-15`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Format text using basic rules when OpenAI is not available
 */
async function formatWithBasicRules(text: string, format: string, userType: string): Promise<string> {
  switch (format) {
    case 'SOAP':
      return formatAsSOAP(text, userType);
    case 'Clinical Summary':
      return formatAsClinicalSummary(text, userType);
    case 'Bullet Points':
      return formatAsBulletPoints(text, userType);
    case 'HTML':
      return formatAsHTML(text, userType);
    case 'Markdown':
      return formatAsMarkdown(text, userType);
    case 'Plain':
    default:
      return text;
  }
}

/**
 * Format text in SOAP (Subjective, Objective, Assessment, Plan) format
 */
function formatAsSOAP(text: string, userType: string): string {
  const subjective = extractSubjective(text);
  const objective = extractObjective(text);
  const assessment = extractAssessment(text);
  const plan = extractPlan(text);
  
  return `# SOAP Note

## Subjective
${subjective}

## Objective
${objective}

## Assessment
${assessment}

## Plan
${plan}`;
}

/**
 * Format text as a clinical summary
 */
function formatAsClinicalSummary(text: string, userType: string): string {
  const summary = extractSummary(text);
  const keyPoints = extractKeyPoints(text);
  const plan = extractPlan(text);
  
  return `# Clinical Summary

## Overview
${summary}

## Key Findings
${keyPoints}

## Plan
${plan}`;
}

/**
 * Format text as bullet points
 */
function formatAsBulletPoints(text: string, userType: string): string {
  const lines = text.split(/[.!?]\s+/);
  const bullets = lines
    .filter(line => line.trim().length > 0)
    .map(line => `• ${line.trim()}${line.trim().endsWith('.') ? '' : '.'}`)
    .join('\n');
  
  return bullets;
}

/**
 * Format text as HTML with appropriate styling
 */
function formatAsHTML(text: string, userType: string): string {
  let html = '<div class="transcription">';
  
  if (userType === 'General Practitioner') {
    const subjective = extractSubjective(text);
    const objective = extractObjective(text);
    const assessment = extractAssessment(text);
    const plan = extractPlan(text);
    
    html += `
      <h2>SOAP Note</h2>
      
      <h3>Subjective</h3>
      <p>${subjective.replace(/\n/g, '<br>')}</p>
      
      <h3>Objective</h3>
      <p>${objective.replace(/\n/g, '<br>')}</p>
      
      <h3>Assessment</h3>
      <p>${assessment.replace(/\n/g, '<br>')}</p>
      
      <h3>Plan</h3>
      <p>${plan.replace(/\n/g, '<br>')}</p>
    `;
  } else {
    // Basic HTML formatting for other user types
    const paragraphs = text.split('\n\n');
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim()) {
        html += `<p>${paragraph.replace(/\n/g, '<br>')}</p>`;
      }
    }
  }
  
  html += '</div>';
  return html;
}

/**
 * Format text as Markdown
 */
function formatAsMarkdown(text: string, userType: string): string {
  if (userType === 'General Practitioner') {
    return formatAsSOAP(text, userType);
  } else {
    // Basic Markdown formatting
    const paragraphs = text.split('\n\n');
    let markdown = '';
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim()) {
        markdown += `${paragraph.trim()}\n\n`;
      }
    }
    
    return markdown;
  }
}

// Helper functions to extract different sections from the text
// These are simple implementations and could be enhanced with NLP in a production environment

function extractSubjective(text: string): string {
  // Look for patient complaints, history, symptoms
  const subjPatterns = [
    /(?:patient|client) (?:reports|states|complains|presents with) (.*?)(?=\.|$)/i,
    /(?:history|complaint|reason for visit|chief complaint):? (.*?)(?=\.|$)/i,
    /(?:symptoms|subjective findings):? (.*?)(?=\.|$)/i
  ];
  
  return extractWithPatterns(text, subjPatterns, 'No subjective information found.');
}

function extractObjective(text: string): string {
  // Look for vital signs, examination findings, test results
  const objPatterns = [
    /(?:vitals|vital signs|examination|exam|physical exam):? (.*?)(?=\.|$)/i,
    /(?:observed|noted|findings|results):? (.*?)(?=\.|$)/i,
    /(?:temperature|pulse|blood pressure|bp|heart rate|respiratory rate):? (.*?)(?=\.|$)/i
  ];
  
  return extractWithPatterns(text, objPatterns, 'No objective findings recorded.');
}

function extractAssessment(text: string): string {
  // Look for diagnoses, impressions, assessments
  const assessPatterns = [
    /(?:assessment|diagnosis|impression|evaluation):? (.*?)(?=\.|$)/i,
    /(?:diagnosed with|condition|disorder):? (.*?)(?=\.|$)/i,
    /(?:assessment and plan|a\/p):? (.*?)(?=\.|$)/i
  ];
  
  return extractWithPatterns(text, assessPatterns, 'No assessment provided.');
}

function extractPlan(text: string): string {
  // Look for treatment plans, medications, follow-ups
  const planPatterns = [
    /(?:plan|treatment|therapy|management):? (.*?)(?=\.|$)/i,
    /(?:prescribed|recommended|advised):? (.*?)(?=\.|$)/i,
    /(?:follow-up|follow up|return|next visit):? (.*?)(?=\.|$)/i
  ];
  
  return extractWithPatterns(text, planPatterns, 'No plan documented.');
}

function extractSummary(text: string): string {
  // Extract first few sentences as summary
  const sentences = text.split(/[.!?]\s+/);
  const summary = sentences.slice(0, 3).join('. ');
  return summary || 'No summary available.';
}

function extractKeyPoints(text: string): string {
  // Extract key points based on common patterns
  const keyPointPatterns = [
    /(?:key|important|significant|notable) (?:points|findings|observations):? (.*?)(?=\.|$)/i,
    /(?:primary|main|chief) (?:concern|complaint|issue|problem):? (.*?)(?=\.|$)/i,
    /(?:diagnosis|assessment):? (.*?)(?=\.|$)/i
  ];
  
  const keyPoints = extractWithPatterns(text, keyPointPatterns, '');
  
  if (keyPoints.trim()) {
    return keyPoints;
  }
  
  // If no key points found with patterns, extract sentences with important medical terms
  const medicalTerms = ['diagnosis', 'condition', 'treatment', 'symptom', 'pain', 'medication'];
  const sentences = text.split(/[.!?]\s+/);
  
  const relevantSentences = sentences.filter(sentence => 
    medicalTerms.some(term => sentence.toLowerCase().includes(term))
  );
  
  if (relevantSentences.length > 0) {
    return relevantSentences.map(s => `• ${s.trim()}`).join('\n');
  }
  
  return 'No key points identified.';
}

function extractWithPatterns(text: string, patterns: RegExp[], defaultText: string): string {
  let extracted = '';
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches[1]) {
      extracted += `${matches[1].trim()}. `;
    }
  }
  
  return extracted || defaultText;
}
