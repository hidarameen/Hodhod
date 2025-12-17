# Overview

BotNexus is an advanced Telegram bot automation system with AI integration. The application provides a comprehensive control panel for managing message forwarding tasks across multiple Telegram channels and sources. It features intelligent message processing using multiple AI providers (OpenAI, Anthropic Claude, Groq, HuggingFace), video-to-text transcription with summarization, and a modern web-based dashboard for system monitoring and configuration.

The system is built as a full-stack application with a Python-based Telegram bot backend (using Pyrogram) and a React/TypeScript web frontend, connected via a Node.js/Express API server with PostgreSQL database storage.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client application is built using modern React with TypeScript and follows a component-based architecture:

- **UI Framework**: React 18+ with Vite as the build tool and development server
- **Styling**: Tailwind CSS with custom design system, featuring a dark theme with glassmorphic UI elements
- **Component Library**: Radix UI primitives wrapped in custom components using shadcn/ui pattern
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Internationalization**: i18next with support for English and Arabic (RTL)
- **Type Safety**: Full TypeScript coverage with path aliases for clean imports

**Design Pattern**: The frontend follows a component-driven architecture with separation between UI components (`/components/ui`), page components (`/pages`), and shared utilities (`/lib`). The application uses a centralized API client pattern for backend communication.

## Backend Architecture

### Node.js API Server

- **Framework**: Express.js with TypeScript
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with connection pooling via `@neondatabase/serverless`
- **Authentication**: Session-based auth with bcrypt for password hashing
- **API Design**: RESTful endpoints organized by resource type

**Storage Layer**: The application uses a centralized storage module (`server/storage.ts`) that provides a clean interface for all database operations, abstracting Drizzle queries behind a typed API.

### Python Telegram Bot

- **Framework**: Pyrogram for Telegram Bot API interaction
- **Architecture**: Event-driven with handler-based command processing
- **Concurrency**: Async/await pattern with asyncio for parallel task execution
- **Queue System**: Custom worker pool implementation for parallel message processing
- **Error Handling**: Comprehensive error logging system with component-level tracking

**Key Services**:
- **Forwarding Engine**: Core message routing with deduplication and caching
- **AI Providers**: Unified interface for multiple LLM providers with model-specific implementations
- **Video Processor**: FFmpeg-based video-to-audio extraction with Whisper transcription
- **Queue Manager**: Worker pool system for parallel job processing

**Design Pattern**: The bot uses a modular service-oriented architecture where each major feature (AI, video processing, forwarding) is encapsulated in its own service module with clear interfaces.

## Data Architecture

### Database Schema

The PostgreSQL schema (defined in `shared/schema.ts`) uses Drizzle ORM with the following core tables:

- **users**: Web dashboard authentication and authorization
- **admins**: Telegram bot administrator management (linked by telegram_id)
- **channels**: Source and target channel definitions with type and metadata
- **forwarding_tasks**: Task configurations with source/target mappings
- **ai_providers**: AI service provider configurations and API keys
- **ai_models**: Available models per provider
- **ai_rules**: Per-task AI processing rules and prompts
- **task_logs**: Execution history and event tracking
- **task_stats**: Aggregated performance metrics

**Design Decisions**:
- JSONB columns for flexible metadata and configuration storage
- Separate tables for AI providers and models to support multi-provider architecture
- Task-to-channel relationships stored as integer arrays for simplicity
- Timestamp tracking on all major entities for auditing

## Integration Architecture

### Frontend-Backend Communication

The system uses a typed API client (`client/src/lib/api.ts`) that wraps fetch calls with:
- Centralized error handling
- Type-safe request/response interfaces
- Automatic JSON serialization
- Cookie-based session management

### Bot-Database Communication

The Python bot connects directly to PostgreSQL using asyncpg for:
- High-performance async database operations
- Connection pooling for concurrent task execution
- Direct SQL queries for complex analytics

**Trade-off**: Direct database access from the bot provides better performance but creates tight coupling. An alternative would be routing bot database operations through the Node.js API, which would improve separation of concerns at the cost of added latency.

## AI Integration

The system supports multiple AI providers through a unified interface pattern:

- **Provider Abstraction**: Base `AIProvider` class with provider-specific implementations
- **Model Configuration**: Database-driven model availability and configuration
- **Prompt Management**: Task-specific AI rules with customizable prompts and parameters
- **Fallback Strategy**: Provider selection allows for failover between services

**Design Choice**: Each AI provider has its own implementation class inheriting from a common base, allowing for provider-specific features while maintaining a consistent interface for the forwarding engine.

## Video Processing Pipeline

Video messages flow through a multi-stage pipeline:

1. Download from Telegram
2. Audio extraction using FFmpeg
3. Transcription via Whisper API
4. Text summarization using configured AI provider
5. Result forwarding to target channels

**Architecture Decision**: Video processing runs asynchronously in the queue system to avoid blocking message forwarding, with temporary file cleanup after processing.

## Bug Fixes (Dec 2024)

### Text Summarization Function Fixed
- **Issue**: The text summarization feature was not working even when enabled in the control panel
- **Root Cause**: The `apply_summarization_rule` method was missing from the AIRuleEngine class
- **Solution**: Implemented the missing `apply_summarization_rule` method that truncates text to specified max length while preserving word boundaries
- **Date Fixed**: 2025-12-07
- **File Modified**: `telegram_bot/services/ai_rule_engine.py`

### Audio Processing Not Working (MP3/Voice Files)
- **Issue**: MP3 and voice audio files were:
  1. Not being summarized (full transcript was used instead)
  2. Telegraph links weren't showing in captions
  3. AI was not applying summarization rules
- **Root Causes**: 
  1. **CRITICAL BUG**: Audio processor used `result.text` but `PipelineResult` has `final_text` - AI summary was never used!
  2. Pre-truncation summarization rule was just truncating, not summarizing
  3. Summarization rules lacked 'prompt' field so they weren't included in AI prompt instructions
  4. Telegraph HTML formatting had extra whitespace causing creation to fail
  5. Audio processor wasn't using Groq fallback when no provider configured
- **Solution Applied**:
  1. **CRITICAL FIX** in `telegram_bot/services/audio_processor.py`:
     - Changed `result.text` to `result.final_text` (line 192-193) - AI summary now used!
  2. Modified `telegram_bot/services/ai_pipeline.py` to:
     - Skip pre-truncation summarization (let AI do full summarization)
     - Build proper AI instructions from summarization rule configs
     - Include rule maxLength and style in AI prompt
  3. Modified `telegram_bot/services/audio_processor.py` to:
     - Use Groq as fallback provider when none is configured
     - Pass task_config for rule application
     - Fix Telegraph HTML formatting
  4. Changed `telegram_bot/services/forwarding_engine.py` to always process audio (removed flag dependency)
- **Features Now Working**:
  ✅ Full AI-generated audio summaries (not just transcripts)
  ✅ Summarization rules applied via AI prompt
  ✅ Telegraph page with full transcript + summary
  ✅ Telegraph link in caption: "اقرأ النص الكامل المُفرّغ"
  ✅ Groq fallback when no provider configured
  ✅ Proper HTML formatting for Telegraph content
- **Date Fixed**: 2025-12-07
- **Files Modified**: 
  - `telegram_bot/services/audio_processor.py` (line 192: `result.text` → `result.final_text`)
  - `telegram_bot/services/ai_pipeline.py` (lines 144-145: skip truncation, 332-349: build proper prompts from rules)
  - `telegram_bot/services/forwarding_engine.py` (line 365: removed `audio_processing and` check)

## Link Processing Pipeline (Enhanced Dec 2024)

Link processing for social media videos (YouTube, TikTok, Instagram, etc.):

1. **Download**: yt-dlp with format fallback mechanism (4 quality levels)
2. **Audio Extraction**: FFmpeg for MP3 extraction
3. **Transcription**: Groq Whisper API (whisper-large-v3-turbo)
4. **Summarization**: AI provider with video-specific rules
5. **Telegraph**: Create page with full transcript
6. **Video Send**: With thumbnail, duration, and metadata

**Recent Improvements (Dec 2024)**:
- Format fallback: Prioritizes single-file formats with embedded audio (`acodec!=none`)
- Thumbnail generation: Auto-generate preview image from video
- Video metadata: Duration, width, height properly extracted via ffprobe
- Rule separation: Video rules are now separate from text summarization rules
- Quality selection UI: Improved visual design with icons and size estimates

# External Dependencies

## Third-Party Services

### AI Providers
- **OpenAI**: GPT-4, GPT-3.5 models for text generation and summarization
- **Anthropic (Claude)**: Opus, Sonnet, Haiku models as alternative LLM providers
- **Groq**: Fast inference for Mixtral and LLaMA models
- **HuggingFace**: Open-source model hosting and inference API

### Media Processing
- **FFmpeg**: Video-to-audio conversion and media manipulation (system dependency)
- **OpenAI Whisper**: Speech-to-text transcription for video content

### Telegram Integration
- **Telegram Bot API**: Message sending, webhook handling
- **Telegram MTProto API**: Advanced client features via Pyrogram
- **Bot Token**: Required from @BotFather
- **API ID/Hash**: Required from my.telegram.org for Pyrogram

## Database & Infrastructure

- **PostgreSQL**: Primary data store (version 13+)
- **Neon Database**: Serverless PostgreSQL provider (via @neondatabase/serverless)

**Database Choice Rationale**: PostgreSQL provides JSONB support for flexible schema elements, strong ACID guarantees for task coordination, and excellent performance for the query patterns used in dashboard analytics.

## Frontend Libraries

### UI Components
- **Radix UI**: Accessible primitive components for complex UI patterns
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Animation library for smooth transitions
- **Recharts**: Chart library for analytics visualization
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety across the codebase
- **Drizzle Kit**: Database migration and schema management

## Build & Deployment

- **esbuild**: Server bundle compilation for production
- **tsx**: TypeScript execution for development
- **Replit**: Hosting platform with environment variable management

**Build Strategy**: The application uses a custom build script that separately bundles the client (via Vite) and server (via esbuild), with selective dependency bundling to optimize cold start performance.