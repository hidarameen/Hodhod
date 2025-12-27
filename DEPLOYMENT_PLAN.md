# BotNexus - Comprehensive Deployment Plan

## Overview
This document outlines the complete deployment strategy for BotNexus across different platforms including Docker, Procfile-based hosting (Heroku, Railway), and Northflanks.

## System Architecture

### Components
1. **Frontend** - React/TypeScript + Vite (Port 5000)
2. **Backend** - Express/TypeScript + Node.js (Port 3000)
3. **Telegram Bot** - Python/Pyrogram (background process)
4. **Database** - PostgreSQL
5. **AI Services** - OpenAI, Anthropic, Groq, HuggingFace

---

## Phase 1: Dependency Preparation

### 1.1 Node.js Dependencies
- **Status**: All installed via package.json
- **Package Manager**: npm/bun
- **Installation**: `npm install`

### 1.2 Python Dependencies
- **Source**: pyproject.toml
- **Python Version**: 3.11+
- **Installation**: `pip install -r requirements.txt`

### 1.3 System Dependencies
- **FFmpeg**: Required for video processing
- **PostgreSQL Client**: For database migrations
- **Python Development Headers**: For compiling Python packages

### 1.4 Database Requirements
- **Type**: PostgreSQL 13+
- **Migrations**: Handled by Drizzle ORM
- **Setup**: Automatic via `npm run db:push`

---

## Phase 2: Environment Configuration

### 2.1 Required Environment Variables

#### Database
- `DATABASE_URL` - PostgreSQL connection string

#### Telegram Bot
- `BOT_TOKEN` - Telegram bot token from @BotFather
- `API_ID` - Telegram API ID from my.telegram.org
- `API_HASH` - Telegram API hash from my.telegram.org

#### AI Providers
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic (Claude) API key
- `GROQ_API_KEY` - Groq API key
- `HUGGINGFACE_API_KEY` - HuggingFace API key (optional)

#### Application
- `NODE_ENV` - environment (development/production)
- `SESSION_SECRET` - Session encryption secret
- `ADMIN_PASSWORD_HASH` - bcrypt hash of admin password

### 2.2 Optional Configuration
- `LOG_LEVEL` - Log verbosity (debug/info/warn/error)
- `MAX_RESTART_ATTEMPTS` - Bot restart retry limit
- `RESTART_DELAY` - Delay between restart attempts (ms)

---

## Phase 3: Build Process

### 3.1 Development Build
```bash
npm run dev                  # Frontend dev server
npm run dev:client          # Frontend only
NODE_ENV=development tsx server/index.ts  # Backend server
python telegram_bot/main.py # Telegram bot
```

### 3.2 Production Build
```bash
npm run build               # Compile frontend + backend
npm run db:push            # Apply database migrations
npm run start              # Start production server
```

### 3.3 Build Output
- **Client Bundle**: `dist/client/`
- **Server Bundle**: `dist/index.cjs`
- **Assets**: Static files in `dist/client/`

---

## Phase 4: Database Setup

### 4.1 Automatic Initialization
1. Database URL provided via environment
2. Run migrations: `npm run db:push`
3. Creates all necessary tables
4. No manual SQL required

### 4.2 Database Schema
Location: `shared/schema.ts`
Tables include:
- users, admins, channels
- forwarding_tasks, ai_providers
- ai_models, ai_rules
- task_logs, task_stats

### 4.3 Backup & Recovery
- PostgreSQL native backups
- Consider pg_dump for automated backups
- Point-in-time recovery supported

---

## Phase 5: Docker Deployment

### 5.1 Docker Image Build
```bash
docker build -t botnexus:latest .
docker build -t botnexus:production -f Dockerfile.prod .
```

### 5.2 Docker Compose (Local Development)
```bash
docker-compose up                 # Start all services
docker-compose down              # Stop services
docker-compose logs -f app       # View logs
```

### 5.3 Production Docker
- Multi-stage build for optimization
- Node.js 20 Alpine base image
- Minimal final image size
- Health checks configured

---

## Phase 6: Procfile Deployment (Heroku/Railway)

### 6.1 Process Types
```procfile
release: npm run db:push
web: npm run start
bot: python telegram_bot/main.py
worker: node dist/index.cjs
```

### 6.2 Deployment Steps
1. Connect Git repository
2. Set environment variables in platform UI
3. Push to main branch
4. Automatic build & deploy
5. Bot process runs alongside web

### 6.3 Platform-Specific Setup

#### Heroku
```bash
heroku create botnexus
heroku config:set DATABASE_URL=postgresql://...
heroku config:set BOT_TOKEN=xxx
git push heroku main
```

#### Railway
- GitHub OAuth integration
- Automatic deployment on push
- PostgreSQL plugin for database
- Environment variables in .railway.json

---

## Phase 7: Northflanks Deployment

### 7.1 Configuration Files
- `.northflanks/services.yml` - Service definitions
- `.northflanks/volumes.yml` - Storage configuration
- `.northflanks/env.yml` - Environment variables

### 7.2 Service Setup
1. **Frontend Service**
   - Build command: `npm run build`
   - Start command: `npm run start`
   - Port: 5000
   - Health check: `GET /health`

2. **Telegram Bot Service**
   - Build command: `pip install -r requirements.txt && npm install`
   - Start command: `python telegram_bot/main.py`
   - No port exposure
   - Restart policy: always

3. **Database Service**
   - PostgreSQL addon
   - Automatic backups
   - Connection pooling

### 7.3 Northflanks Deployment Steps
1. Connect GitHub repository
2. Select Node.js builder
3. Configure environment variables
4. Deploy database
5. Deploy services
6. Configure networking

---

## Phase 8: Health Checks & Monitoring

### 8.1 Application Health Endpoints
```
GET /health - Server status
GET /api/health - API status
GET /metrics - Performance metrics (optional)
```

### 8.2 Process Monitoring
- Docker health checks
- Procfile restart policies
- Northflanks auto-restart
- Logging aggregation

### 8.3 Database Health
- Connection pool monitoring
- Query performance tracking
- Backup verification

---

## Phase 9: Post-Deployment

### 9.1 Verification Steps
- [ ] Frontend loads successfully
- [ ] API endpoints respond
- [ ] Database migrations applied
- [ ] Bot process running
- [ ] Environment variables set
- [ ] Logs accessible

### 9.2 Performance Optimization
- CDN for static assets
- Database query optimization
- Connection pooling tuning
- Cache warming

### 9.3 Security Hardening
- HTTPS enforcement
- CORS configuration
- Rate limiting
- Input validation
- Secret rotation

---

## Phase 10: Scaling & Maintenance

### 10.1 Horizontal Scaling
- Load balancing for API servers
- Database read replicas
- Message queue for bot tasks
- Session store (Redis/Memcached)

### 10.2 Monitoring & Logging
- Application performance monitoring
- Error tracking (Sentry)
- Log aggregation (ELK stack)
- Uptime monitoring

### 10.3 Update Strategy
- Blue-green deployments
- Database migration safety
- Rollback procedures
- Canary releases

---

## Scripts & Automation

### Quick Start
```bash
# Clone repository
git clone <repo-url>
cd botnexus

# Setup environment
cp .env.example .env
# Edit .env with your values

# Install dependencies
npm install
pip install -r requirements.txt

# Setup database
npm run db:push

# Development
npm run dev
```

### Docker Quick Start
```bash
# Build image
docker build -t botnexus .

# Run container
docker run -e DATABASE_URL=... \
           -e BOT_TOKEN=... \
           -p 5000:5000 \
           botnexus
```

### Deployment Helper Scripts
- `scripts/setup.sh` - Initial setup
- `scripts/deploy.sh` - Deployment automation
- `scripts/migrate-db.sh` - Database migration
- `scripts/health-check.sh` - Service verification

---

## Troubleshooting

### Common Issues

#### Database Connection Failures
- Verify DATABASE_URL format
- Check network access
- Verify credentials
- Review connection limits

#### Bot Process Crashes
- Check Telegram credentials
- Verify BOT_TOKEN validity
- Review error logs
- Check system resources

#### Memory Issues
- Reduce worker pool size
- Optimize database queries
- Implement caching
- Monitor process memory

---

## Timeline

- **Phase 1-2**: Day 1 (Setup & Configuration)
- **Phase 3-4**: Day 2 (Build & Database)
- **Phase 5**: Day 3 (Docker)
- **Phase 6**: Day 4 (Procfile)
- **Phase 7**: Day 5 (Northflanks)
- **Phase 8-10**: Ongoing (Monitoring & Optimization)

---

## Support & Resources

- Docker Documentation: https://docs.docker.com
- Heroku Documentation: https://devcenter.heroku.com
- Railway Documentation: https://docs.railway.app
- Northflanks Documentation: https://northflank.com/docs
- PostgreSQL Documentation: https://www.postgresql.org/docs/

