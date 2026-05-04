-- v89: Cruzar Ticket as Sidera cross-product identity substrate
-- linked_products JSONB stores context written by other Sidera products
-- Shape: { "borvo": { ... }, "fletcher": { ... } }
-- Products write their own namespaced key via POST /api/ticket/[id]/link

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS linked_products JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.tickets.linked_products IS
  'Cross-product context keyed by Sidera product name. Written via POST /api/ticket/[id]/link.';
