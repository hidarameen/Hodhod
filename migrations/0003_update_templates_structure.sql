
-- Drop old columns from ai_publishing_templates
ALTER TABLE ai_publishing_templates 
  DROP COLUMN IF EXISTS header_template,
  DROP COLUMN IF EXISTS body_template,
  DROP COLUMN IF EXISTS footer_template,
  DROP COLUMN IF EXISTS extract_fields,
  DROP COLUMN IF EXISTS use_markdown,
  DROP COLUMN IF EXISTS use_bold,
  DROP COLUMN IF EXISTS use_italic;

-- Add new columns to ai_publishing_templates
ALTER TABLE ai_publishing_templates
  ADD COLUMN IF NOT EXISTS header_text TEXT,
  ADD COLUMN IF NOT EXISTS header_formatting TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS footer_text TEXT,
  ADD COLUMN IF NOT EXISTS footer_formatting TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS field_separator TEXT DEFAULT E'\n',
  ADD COLUMN IF NOT EXISTS use_newline_after_header BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS use_newline_before_footer BOOLEAN NOT NULL DEFAULT true;

-- Create template_custom_fields table
CREATE TABLE IF NOT EXISTS template_custom_fields (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES ai_publishing_templates(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  extraction_instructions TEXT NOT NULL,
  default_value TEXT,
  use_default_if_empty BOOLEAN NOT NULL DEFAULT true,
  formatting TEXT NOT NULL DEFAULT 'none',
  display_order INTEGER NOT NULL DEFAULT 0,
  show_label BOOLEAN NOT NULL DEFAULT false,
  label_separator TEXT DEFAULT ': ',
  prefix TEXT,
  suffix TEXT,
  field_type TEXT NOT NULL DEFAULT 'extracted',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for template_custom_fields
CREATE INDEX IF NOT EXISTS idx_template_custom_fields_template_id ON template_custom_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_template_custom_fields_display_order ON template_custom_fields(display_order);
