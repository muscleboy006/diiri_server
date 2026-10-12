CREATE TABLE IF NOT EXISTS omonat (
  id          SERIAL PRIMARY KEY,
  owner_id    BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  title       VARCHAR(100) NOT NULL,
  description TEXT,
  from_city   VARCHAR(60) NOT NULL,
  to_city     VARCHAR(60) NOT NULL,
  price       INTEGER NOT NULL DEFAULT 0,
  status      VARCHAR(10) NOT NULL DEFAULT 'active',
  images      TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omonat_active_created ON omonat (created_at DESC, id DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_omonat_active_price ON omonat (price, id DESC) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS omonat_owner_idx  ON omonat(owner_id);
CREATE INDEX IF NOT EXISTS omonat_status_idx ON omonat(status, created_at DESC);

ALTER TABLE omonat ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE omonat DROP COLUMN IF EXISTS weight_kg;