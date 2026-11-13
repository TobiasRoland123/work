CREATE TABLE slack_import_runs (
 id text PRIMARY KEY,
 config jsonb NOT NULL,
 cutoff timestamptz NOT NULL,
 coverage jsonb NOT NULL,
 months jsonb NOT NULL,
 month_index integer NOT NULL DEFAULT 0,
 paused boolean NOT NULL DEFAULT false,
 spent numeric NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE slack_import_runs ENABLE ROW LEVEL SECURITY;
CREATE TABLE slack_import_items (
 run_id text NOT NULL REFERENCES slack_import_runs(id),
 month text NOT NULL,
 message_key text NOT NULL,
 revision text NOT NULL,
 message_ts text NOT NULL,
 author text,
 source jsonb,
 outcome text NOT NULL DEFAULT 'fetched',
 reason text,
 proposal jsonb,
 before_state jsonb,
 after_state jsonb,
 reserved_usd numeric NOT NULL DEFAULT 0,
 attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (run_id, message_key)
);
ALTER TABLE slack_import_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX slack_import_items_month ON slack_import_items(run_id, month, outcome);
