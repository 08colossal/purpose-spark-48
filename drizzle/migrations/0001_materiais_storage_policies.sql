CREATE POLICY "materiais_teacher_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materiais' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "materiais_teacher_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'materiais' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "materiais_teacher_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'materiais' AND (storage.foldername(name))[1] = auth.uid()::text);