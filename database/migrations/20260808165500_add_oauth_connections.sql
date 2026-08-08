create table if not exists oauth_connections (
  provider text primary key,
  refresh_token_ciphertext text not null,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table oauth_connections enable row level security;
