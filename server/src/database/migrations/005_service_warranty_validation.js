export const serviceWarrantyValidationMigration = {
  version: 5,
  name: 'service_resolution_warranty_validation',

  up(database) {
    database.exec(`
      ALTER TABLE service_resolutions
      ADD COLUMN product_serial_id TEXT REFERENCES product_serials(id);

      CREATE TRIGGER service_resolution_serial_matches_ticket_insert
      BEFORE INSERT ON service_resolutions
      WHEN NEW.product_serial_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM service_ticket_items
          WHERE ticket_id = NEW.ticket_id AND product_serial_id = NEW.product_serial_id
        )
      BEGIN
        SELECT RAISE(ABORT, 'Service resolution serial must be attached to its ticket');
      END;

      CREATE TRIGGER service_resolution_serial_matches_ticket_update
      BEFORE UPDATE OF ticket_id, product_serial_id ON service_resolutions
      WHEN NEW.product_serial_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM service_ticket_items
          WHERE ticket_id = NEW.ticket_id AND product_serial_id = NEW.product_serial_id
        )
      BEGIN
        SELECT RAISE(ABORT, 'Service resolution serial must be attached to its ticket');
      END;

      CREATE TRIGGER service_resolution_covered_requires_active_warranty_insert
      BEFORE INSERT ON service_resolutions
      WHEN NEW.warranty_coverage = 'COVERED'
        AND NOT EXISTS (
          SELECT 1
          FROM service_ticket_items ticket_item
          JOIN warranty_records warranty
            ON warranty.product_serial_id = ticket_item.product_serial_id
          WHERE ticket_item.ticket_id = NEW.ticket_id
            AND ticket_item.product_serial_id = NEW.product_serial_id
            AND warranty.status = 'ACTIVE'
            AND date(NEW.resolved_at) BETWEEN warranty.starts_on AND warranty.ends_on
        )
      BEGIN
        SELECT RAISE(ABORT, 'Covered service requires an active in-term warranty for its serial');
      END;

      CREATE TRIGGER service_resolution_covered_requires_active_warranty_update
      BEFORE UPDATE OF ticket_id, product_serial_id, warranty_coverage, resolved_at
      ON service_resolutions
      WHEN NEW.warranty_coverage = 'COVERED'
        AND NOT EXISTS (
          SELECT 1
          FROM service_ticket_items ticket_item
          JOIN warranty_records warranty
            ON warranty.product_serial_id = ticket_item.product_serial_id
          WHERE ticket_item.ticket_id = NEW.ticket_id
            AND ticket_item.product_serial_id = NEW.product_serial_id
            AND warranty.status = 'ACTIVE'
            AND date(NEW.resolved_at) BETWEEN warranty.starts_on AND warranty.ends_on
        )
      BEGIN
        SELECT RAISE(ABORT, 'Covered service requires an active in-term warranty for its serial');
      END;
    `)
  },
}
