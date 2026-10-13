alter table order_intents
  add column email_token text;

alter table order_intents
  add constraint order_intents_email_token_format
  check (email_token ~ '^[0-9a-f]{32}$');

create unique index order_intents_email_token_key
  on order_intents (email_token)
  where email_token is not null;

alter table companies
  add constraint companies_order_alias_not_cart_token
  check (lower(order_alias::text) not like 'cart-%');
