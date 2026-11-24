-- =====================================================================
-- INVERSAM MANAGER — Almacenamiento de fotografías de órdenes
-- Bucket privado; las imágenes se sirven con URLs firmadas.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('work-order-photos', 'work-order-photos', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "wo photos read" on storage.objects for select to authenticated
  using (bucket_id = 'work-order-photos' and public.is_staff());

create policy "wo photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'work-order-photos' and public.has_role('admin', 'recepcionista', 'mecanico'));

create policy "wo photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'work-order-photos' and public.has_role('admin', 'recepcionista'));
