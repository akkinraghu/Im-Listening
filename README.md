# I'm Listening

A full-stack application that combines voice transcription with semantic search capabilities.

## Features

- **Real-time Voice Transcription**: Uses DeepGram's live socket API to transcribe voice in real-time
- **Semantic Search**: Processes articles, creates embeddings using Azure OpenAI, and enables semantic search
- **AI-Powered Formatting**: Converts transcriptions to various formats (SOAP notes, clinical summaries, etc.) using OpenAI
- **User Context Awareness**: Adapts functionality based on user type (General Practitioner, School Lecture, Personal)
- **MongoDB Integration**: Stores transcriptions, articles, and vector embeddings
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS with a purple and silver theme

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (BFF pattern)
- **Database**: MongoDB
- **AI Services**: OpenAI API, Azure OpenAI API
- **Speech Recognition**: DeepGram API
- **Testing**: Jest

## Project Structure

```
im-listening/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/              # API Routes
│   │   ├── transcription/    # Transcription page
│   │   └── search/           # Search page
│   ├── components/           # React components
│   ├── lib/                  # Utility libraries
│   │   ├── mongodb.ts        # MongoDB connection
│   │   └── migrations/       # Database migrations
│   ├── models/               # MongoDB models
│   ├── services/             # Service layer
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── public/                   # Static assets
└── ...config files
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB instance (local or Atlas)
- DeepGram API key
- OpenAI API key (optional, for advanced formatting)

### Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```
# MongoDB
MONGODB_URI=mongodb://localhost:27017/im_listening

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_key_here

# DeepGram API
DEEPGRAM_API_KEY=your_deepgram_api_key_here
NEXT_PUBLIC_DEEPGRAM_API_KEY=your_deepgram_api_key_here

# OpenAI (Standard API)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4

# Azure OpenAI (Optional)
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_ENDPOINT=your_azure_openai_endpoint_here
AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name_here
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Endpoints

### Transcription

- `GET /api/transcription` - Get all transcriptions
- `POST /api/transcription` - Create a new transcription
- `GET /api/transcription/[id]` - Get a specific transcription
- `PUT /api/transcription/[id]` - Update a transcription
- `DELETE /api/transcription/[id]` - Delete a transcription

### Articles

- `GET /api/articles` - Get all articles
- `POST /api/articles` - Create a new article
- `GET /api/articles/[id]` - Get a specific article
- `PUT /api/articles/[id]` - Update an article
- `DELETE /api/articles/[id]` - Delete an article
- `GET /api/articles/[id]/chunks` - Get chunks for an article
- `POST /api/articles/[id]/chunks` - Generate chunks and embeddings

### Search

- `POST /api/search` - Perform semantic search

## Database Models

- **Transcription**: Stores voice transcriptions
- **Article**: Stores article content and metadata
- **ArticleChunk**: Stores article chunks with embeddings for semantic search
- **User**: Stores user information

## Future Enhancements

- User authentication and authorization
- Real-time article ingestion from multiple sources
- Advanced search filters and facets
- Improved vector search with Azure OpenAI embeddings
- Mobile application support

## License

MIT
