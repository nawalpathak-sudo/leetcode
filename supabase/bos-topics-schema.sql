-- Add topics array to bos_subjects
ALTER TABLE bos_subjects ADD COLUMN IF NOT EXISTS topics JSONB DEFAULT '[]';
-- topics format: ["Topic 1", "Topic 2", "Topic 3"]
