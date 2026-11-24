-- =====================================================================
-- Catálogo inicial de servicios (solo nombres de ejemplo).
-- Los precios quedan en 0 y sin tiempo estimado A PROPÓSITO: deben ser
-- configurados por INVERSAM desde el módulo Servicios antes de operar.
-- =====================================================================
insert into public.services (name, category, price, estimated_minutes, description) values
  ('Alineamiento',        'Llantas',    0, null, 'Configure precio y tiempo estimado'),
  ('Balanceo',            'Llantas',    0, null, 'Configure precio y tiempo estimado'),
  ('Cambio de aceite',    'Lubricación',0, null, 'Configure precio y tiempo estimado'),
  ('Engrase',             'Lubricación',0, null, 'Configure precio y tiempo estimado'),
  ('Frenos',              'Frenos',     0, null, 'Configure precio y tiempo estimado'),
  ('Suspensión',          'Suspensión', 0, null, 'Configure precio y tiempo estimado'),
  ('Dirección',           'Dirección',  0, null, 'Configure precio y tiempo estimado'),
  ('Escaneo automotriz',  'Diagnóstico',0, null, 'Configure precio y tiempo estimado'),
  ('Cambio de filtros',   'Lubricación',0, null, 'Configure precio y tiempo estimado')
on conflict do nothing;
