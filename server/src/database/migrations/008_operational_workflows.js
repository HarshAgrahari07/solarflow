export const operationalWorkflowsMigration = {
  version: 8,
  name: 'operational_workflows',

  up(database) {
    database.exec(`
      ALTER TABLE quotations
      ADD COLUMN responded_by TEXT REFERENCES users(id) ON DELETE SET NULL;

      ALTER TABLE quotations
      ADD COLUMN responded_at TEXT;

      ALTER TABLE quotations
      ADD COLUMN response_notes TEXT NOT NULL DEFAULT '';

      ALTER TABLE quotations
      ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

      ALTER TABLE inventory_items
      ADD COLUMN reorder_level REAL NOT NULL DEFAULT 0 CHECK (reorder_level >= 0);

      ALTER TABLE package_template_items
      ADD COLUMN unit_price REAL CHECK (unit_price IS NULL OR unit_price >= 0);

      ALTER TABLE quotation_items
      ADD COLUMN product_type TEXT CHECK (
        product_type IS NULL OR product_type IN (
          'PANEL', 'CONNECTOR', 'WIRE', 'INVERTER', 'WIRING_BOXES',
          'CHARGE_CONTROLLER', 'SAFETY_EARTHING', 'METAL_STAND',
          'BATTERY', 'SWITCH', 'SAFETY_PART', 'INSTALLATION_SERVICE', 'OTHER'
        )
      );

      ALTER TABLE installation_jobs
      ADD COLUMN generation_test_result TEXT NOT NULL DEFAULT '';

      ALTER TABLE service_tickets
      ADD COLUMN fault_code TEXT NOT NULL DEFAULT '';

      ALTER TABLE service_tickets
      ADD COLUMN assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL;

      CREATE TABLE quotation_revisions (
        id TEXT PRIMARY KEY NOT NULL,
        quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        version INTEGER NOT NULL CHECK (version > 0),
        snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (quotation_id, version)
      );
      CREATE INDEX idx_quotation_revisions_quote
        ON quotation_revisions(quotation_id, version DESC);

      CREATE INDEX idx_service_tickets_owner_status
        ON service_tickets(assigned_to, status, opened_at);
      CREATE INDEX idx_product_serials_serial_number
        ON product_serials(serial_number);

      DROP TRIGGER full_payment_requires_priced_quote_insert;
      DROP TRIGGER full_payment_requires_priced_quote_update;

      CREATE TRIGGER full_payment_requires_priced_quote_insert
      BEFORE INSERT ON payments
      WHEN NEW.status = 'RECORDED' AND NEW.payment_type = 'FULL'
        AND NOT EXISTS (
          SELECT 1
          FROM orders order_record
          JOIN quotation_items item ON item.quotation_id = order_record.quote_id
          WHERE order_record.id = NEW.order_id
          GROUP BY order_record.id
          HAVING COUNT(*) > 0
            AND COUNT(item.unit_price) = COUNT(*)
            AND NEW.amount + COALESCE((
              SELECT SUM(prior.amount) FROM payments prior
              WHERE prior.order_id = NEW.order_id
                AND prior.status = 'RECORDED'
                AND prior.id <> NEW.id
            ), 0) >= SUM(item.quantity * item.unit_price)
        )
      BEGIN
        SELECT RAISE(ABORT, 'Recorded full payment must cover the priced quotation balance');
      END;

      CREATE TRIGGER full_payment_requires_priced_quote_update
      BEFORE UPDATE OF status, payment_type, amount, order_id ON payments
      WHEN NEW.status = 'RECORDED' AND NEW.payment_type = 'FULL'
        AND NOT EXISTS (
          SELECT 1
          FROM orders order_record
          JOIN quotation_items item ON item.quotation_id = order_record.quote_id
          WHERE order_record.id = NEW.order_id
          GROUP BY order_record.id
          HAVING COUNT(*) > 0
            AND COUNT(item.unit_price) = COUNT(*)
            AND NEW.amount + COALESCE((
              SELECT SUM(prior.amount) FROM payments prior
              WHERE prior.order_id = NEW.order_id
                AND prior.status = 'RECORDED'
                AND prior.id <> NEW.id
            ), 0) >= SUM(item.quantity * item.unit_price)
        )
      BEGIN
        SELECT RAISE(ABORT, 'Recorded full payment must cover the priced quotation balance');
      END;
    `)
  },
}
