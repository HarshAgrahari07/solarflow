export const surveyManagementMigration = {
  version: 7,
  name: 'survey_management',

  up(database) {
    database.exec(`
      ALTER TABLE surveys
      ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT;

      ALTER TABLE surveys
      ADD COLUMN site_address TEXT NOT NULL DEFAULT '';

      ALTER TABLE surveys
      ADD COLUMN assigned_surveyor_id TEXT REFERENCES users(id) ON DELETE RESTRICT;

      ALTER TABLE surveys
      ADD COLUMN scheduled_at TEXT CHECK (scheduled_at IS NULL OR julianday(scheduled_at) IS NOT NULL);

      ALTER TABLE surveys
      ADD COLUMN visit_status TEXT NOT NULL DEFAULT 'SCHEDULED'
        CHECK (visit_status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));

      ALTER TABLE surveys
      ADD COLUMN customer_requirements TEXT NOT NULL DEFAULT '';

      ALTER TABLE surveys
      ADD COLUMN preliminary_observations TEXT NOT NULL DEFAULT '';

      ALTER TABLE surveys
      ADD COLUMN actual_available_roof_area_sqm REAL
        CHECK (actual_available_roof_area_sqm IS NULL OR actual_available_roof_area_sqm >= 0);

      ALTER TABLE surveys
      ADD COLUMN site_condition TEXT NOT NULL DEFAULT '';

      ALTER TABLE surveys
      ADD COLUMN shade_observations TEXT NOT NULL DEFAULT '';

      ALTER TABLE surveys
      ADD COLUMN technical_notes TEXT NOT NULL DEFAULT '';

      ALTER TABLE surveys
      ADD COLUMN submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL;

      ALTER TABLE survey_approvals
      ADD COLUMN review_action TEXT NOT NULL DEFAULT 'LEGACY'
        CHECK (review_action IN ('APPROVE', 'REJECT', 'REQUEST_CORRECTIONS', 'LEGACY'));

      UPDATE surveys
      SET customer_id = (
            SELECT customer_id FROM leads WHERE leads.id = surveys.lead_id
          ),
          site_address = coalesce((
            SELECT address FROM customers
            WHERE customers.id = (
              SELECT customer_id FROM leads WHERE leads.id = surveys.lead_id
            )
          ), ''),
          visit_status = CASE
            WHEN status = 'APPROVED' THEN 'COMPLETED'
            WHEN status = 'PENDING_APPROVAL' THEN 'COMPLETED'
            WHEN status = 'REJECTED' THEN 'IN_PROGRESS'
            ELSE 'SCHEDULED'
          END;

      UPDATE survey_approvals
      SET review_action = CASE decision
        WHEN 'APPROVED' THEN 'APPROVE'
        WHEN 'REJECTED' THEN 'REJECT'
        ELSE 'LEGACY'
      END;

      CREATE INDEX IF NOT EXISTS idx_surveys_customer_schedule
        ON surveys(customer_id, scheduled_at, status);
      CREATE INDEX IF NOT EXISTS idx_surveys_surveyor_schedule
        ON surveys(assigned_surveyor_id, scheduled_at, status);
      CREATE INDEX IF NOT EXISTS idx_survey_approvals_latest
        ON survey_approvals(survey_id, decided_at DESC);

      CREATE TRIGGER surveys_customer_matches_lead_insert
      BEFORE INSERT ON surveys
      WHEN NEW.customer_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM leads
          WHERE leads.id = NEW.lead_id AND leads.customer_id = NEW.customer_id
        )
      BEGIN
        SELECT RAISE(ABORT, 'Survey customer must match its lead customer');
      END;

      CREATE TRIGGER surveys_customer_matches_lead_update
      BEFORE UPDATE OF lead_id, customer_id ON surveys
      WHEN NEW.customer_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM leads
          WHERE leads.id = NEW.lead_id AND leads.customer_id = NEW.customer_id
        )
      BEGIN
        SELECT RAISE(ABORT, 'Survey customer must match its lead customer');
      END;

      CREATE TRIGGER surveys_populate_customer_insert
      AFTER INSERT ON surveys
      WHEN NEW.customer_id IS NULL
      BEGIN
        UPDATE surveys
        SET customer_id = (
              SELECT customer_id FROM leads WHERE leads.id = NEW.lead_id
            ),
            site_address = CASE
              WHEN NEW.site_address = '' THEN coalesce((
                SELECT address FROM customers
                WHERE customers.id = (
                  SELECT customer_id FROM leads WHERE leads.id = NEW.lead_id
                )
              ), '')
              ELSE NEW.site_address
            END
        WHERE id = NEW.id;
      END;

      CREATE TRIGGER surveys_surveyor_role_insert
      BEFORE INSERT ON surveys
      WHEN NEW.assigned_surveyor_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM users
          WHERE id = NEW.assigned_surveyor_id AND role = 'SURVEYOR' AND is_active = 1
        )
      BEGIN
        SELECT RAISE(ABORT, 'Survey assignment requires an active surveyor');
      END;

      CREATE TRIGGER surveys_surveyor_role_update
      BEFORE UPDATE OF assigned_surveyor_id ON surveys
      WHEN NEW.assigned_surveyor_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM users
          WHERE id = NEW.assigned_surveyor_id AND role = 'SURVEYOR' AND is_active = 1
        )
      BEGIN
        SELECT RAISE(ABORT, 'Survey assignment requires an active surveyor');
      END;
    `)
  },
}
