-- AI Content Filters (for filtering messages before forwarding based on context/content)
CREATE TABLE IF NOT EXISTS ai_content_filters (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES forwarding_tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filter_type TEXT NOT NULL, -- 'allow' | 'block' | 'require'
  match_type TEXT NOT NULL, -- 'contains' | 'exact' | 'regex' | 'context' | 'sentiment' | 'ai_analysis'
  pattern TEXT NOT NULL,
  context_description TEXT,
  sentiment_target TEXT, -- 'positive' | 'negative' | 'neutral' | 'any'
  action TEXT NOT NULL DEFAULT 'skip', -- 'skip' | 'forward' | 'modify' | 'flag'
  modify_instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  match_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- AI Publishing Templates (for controlling final message format)
CREATE TABLE IF NOT EXISTS ai_publishing_templates (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES forwarding_tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  template_type TEXT NOT NULL, -- 'news' | 'report' | 'interview' | 'summary' | 'custom'
  header_template TEXT,
  body_template TEXT,
  footer_template TEXT,
  extract_fields JSONB,
  use_markdown BOOLEAN NOT NULL DEFAULT true,
  use_bold BOOLEAN NOT NULL DEFAULT true,
  use_italic BOOLEAN NOT NULL DEFAULT false,
  max_length INTEGER,
  extraction_prompt TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_content_filters_task_id ON ai_content_filters(task_id);
CREATE INDEX IF NOT EXISTS idx_content_filters_active ON ai_content_filters(is_active);
CREATE INDEX IF NOT EXISTS idx_publishing_templates_task_id ON ai_publishing_templates(task_id);
CREATE INDEX IF NOT EXISTS idx_publishing_templates_default ON ai_publishing_templates(is_default);
