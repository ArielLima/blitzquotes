-- Add attachments column to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';

-- Create quote-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-attachments', 'quote-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload attachments to their own quotes
CREATE POLICY "Users can upload quote attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quote-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own attachments
CREATE POLICY "Users can update quote attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'quote-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own attachments
CREATE POLICY "Users can delete quote attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'quote-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access (attachments are displayed on customer-facing quote pages)
CREATE POLICY "Public read access for quote attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'quote-attachments');
