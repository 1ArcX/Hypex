-- Bank-inbox: eigen invoer die niet op het afschrift staat maar wel klopt (bv. contant betaald) als "gecontroleerd"
-- markeren, zodat hij niet steeds in "Niet op afschrift" terugkomt. Zonder deze kolom onthoudt de app het per apparaat.
alter table public.expenses add column if not exists bank_checked boolean not null default false;
