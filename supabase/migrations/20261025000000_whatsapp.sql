-- order updates on WhatsApp (Meta Cloud API); customers can switch them off on /account
alter table public.profiles add column if not exists whatsapp_updates boolean not null default true;
