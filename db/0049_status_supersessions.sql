CREATE TABLE "status_supersessions" (
	"target_status_id" integer NOT NULL,
	"replacement_status_id" integer NOT NULL,
	CONSTRAINT "status_supersessions_target_status_id_replacement_status_id_pk" PRIMARY KEY("target_status_id","replacement_status_id"),
	CONSTRAINT "status_supersessions_not_self" CHECK ("status_supersessions"."target_status_id" <> "status_supersessions"."replacement_status_id")
);
--> statement-breakpoint
ALTER TABLE "status_supersessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "status_supersessions" ADD CONSTRAINT "status_supersessions_target_status_id_status_id_fk" FOREIGN KEY ("target_status_id") REFERENCES "public"."status"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_supersessions" ADD CONSTRAINT "status_supersessions_replacement_status_id_status_id_fk" FOREIGN KEY ("replacement_status_id") REFERENCES "public"."status"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_supersessions_replacement_idx" ON "status_supersessions" USING btree ("replacement_status_id");