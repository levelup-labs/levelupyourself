CREATE TABLE "player_progress" (
	"user_id" text PRIMARY KEY,
	"state" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
