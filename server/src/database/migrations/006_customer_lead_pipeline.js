export const customerLeadPipelineMigration = {
  version: 6,
  name: 'customer_lead_pipeline',

  up(database) {
    database.exec(`
      ALTER TABLE leads
      ADD COLUMN stage TEXT NOT NULL DEFAULT 'New' CHECK (
        stage IN (
          'New', 'Contacted', 'Qualified', 'Survey Pending',
          'Quotation', 'Converted', 'Lost'
        )
      );

      UPDATE leads
      SET stage = CASE status
        WHEN 'Survey Scheduled' THEN 'Survey Pending'
        WHEN 'Quoted' THEN 'Quotation'
        WHEN 'Won' THEN 'Converted'
        ELSE status
      END;

      CREATE INDEX IF NOT EXISTS idx_leads_stage_owner_updated
        ON leads(stage, assigned_to, updated_at);

      CREATE TRIGGER leads_insert_stage_compat
      AFTER INSERT ON leads
      WHEN NEW.stage = 'New' AND NEW.status <> 'New'
      BEGIN
        UPDATE leads
        SET stage = CASE NEW.status
          WHEN 'Survey Scheduled' THEN 'Survey Pending'
          WHEN 'Quoted' THEN 'Quotation'
          WHEN 'Won' THEN 'Converted'
          ELSE NEW.status
        END
        WHERE id = NEW.id;
      END;

      CREATE TRIGGER leads_stage_to_legacy_status
      AFTER UPDATE OF stage ON leads
      WHEN NEW.status IS NOT CASE NEW.stage
        WHEN 'Survey Pending' THEN 'Survey Scheduled'
        WHEN 'Quotation' THEN 'Quoted'
        WHEN 'Converted' THEN 'Won'
        ELSE NEW.stage
      END
      BEGIN
        UPDATE leads
        SET status = CASE NEW.stage
          WHEN 'Survey Pending' THEN 'Survey Scheduled'
          WHEN 'Quotation' THEN 'Quoted'
          WHEN 'Converted' THEN 'Won'
          ELSE NEW.stage
        END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = NEW.id;
      END;

      CREATE TRIGGER leads_legacy_status_to_stage
      AFTER UPDATE OF status ON leads
      WHEN NEW.stage IS NOT CASE NEW.status
        WHEN 'Survey Scheduled' THEN 'Survey Pending'
        WHEN 'Quoted' THEN 'Quotation'
        WHEN 'Won' THEN 'Converted'
        ELSE NEW.status
      END
      BEGIN
        UPDATE leads
        SET stage = CASE NEW.status
          WHEN 'Survey Scheduled' THEN 'Survey Pending'
          WHEN 'Quoted' THEN 'Quotation'
          WHEN 'Won' THEN 'Converted'
          ELSE NEW.status
        END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = NEW.id;
      END;

      DROP VIEW IF EXISTS v_lead_workflow_summary;
      CREATE VIEW v_lead_workflow_summary AS
      SELECT lead.id AS lead_id,
             lead.lead_number,
             lead.stage AS lead_status,
             lead.assigned_to,
             COUNT(DISTINCT survey.id) AS survey_count,
             COUNT(DISTINCT CASE WHEN survey.status = 'APPROVED' THEN survey.id END) AS approved_survey_count,
             COUNT(DISTINCT quote.id) AS quotation_count,
             COUNT(DISTINCT CASE WHEN quote.status IN ('RELEASED', 'ACCEPTED') THEN quote.id END) AS released_quote_count,
             COUNT(DISTINCT orders.id) AS order_count,
             COUNT(DISTINCT follow_up.id) AS follow_up_count
      FROM leads lead
      LEFT JOIN surveys survey ON survey.lead_id = lead.id
      LEFT JOIN quotations quote ON quote.lead_id = lead.id
      LEFT JOIN orders ON orders.quote_id = quote.id
      LEFT JOIN follow_ups follow_up ON follow_up.lead_id = lead.id
      GROUP BY lead.id;
    `)
  },
}
