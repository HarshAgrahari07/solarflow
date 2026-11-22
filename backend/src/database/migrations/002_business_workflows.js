function objectType(database, name) {
  return database.prepare('SELECT type FROM sqlite_master WHERE name = ?').get(name)?.type
}

export const businessWorkflowMigration = {
  version: 2,
  name: 'relational_business_workflows',

  up(database) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS stored_files (
        id TEXT PRIMARY KEY NOT NULL,
        storage_key TEXT NOT NULL UNIQUE CHECK (
          length(storage_key) BETWEEN 1 AND 500
          AND substr(storage_key, 1, 1) <> '/'
          AND instr(storage_key, '\\') = 0
          AND instr(storage_key, '..') = 0
        ),
        original_name TEXT NOT NULL CHECK (length(trim(original_name)) BETWEEN 1 AND 255),
        media_type TEXT NOT NULL CHECK (length(media_type) BETWEEN 1 AND 150),
        byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
        checksum_sha256 TEXT CHECK (
          checksum_sha256 IS NULL OR (
            length(checksum_sha256) = 64
            AND checksum_sha256 NOT GLOB '*[^0-9a-f]*'
          )
        ),
        uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS demo_seed_batches (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS demo_seed_records (
        batch_id TEXT NOT NULL REFERENCES demo_seed_batches(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        PRIMARY KEY (batch_id, entity_type, entity_id)
      );
      CREATE INDEX IF NOT EXISTS idx_demo_seed_records_entity
        ON demo_seed_records(entity_type, entity_id);

      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY NOT NULL,
        lead_number TEXT NOT NULL UNIQUE,
        customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'New' CHECK (
          status IN ('New', 'Contacted', 'Qualified', 'Survey Scheduled', 'Quoted', 'Won', 'Lost')
        ),
        assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
        source TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (
          source IN ('UNKNOWN', 'WEBSITE', 'REFERRAL', 'PHONE', 'WALK_IN', 'DEMO')
        ),
        notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 3000),
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        converted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_leads_status_owner
        ON leads(status, assigned_to, updated_at);

      CREATE TABLE IF NOT EXISTS surveys (
        id TEXT PRIMARY KEY NOT NULL,
        survey_number TEXT NOT NULL UNIQUE,
        lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
        shadow_free_roof_area_sqm REAL CHECK (
          shadow_free_roof_area_sqm IS NULL OR shadow_free_roof_area_sqm >= 0
        ),
        monthly_electricity_bill REAL CHECK (
          monthly_electricity_bill IS NULL OR monthly_electricity_bill >= 0
        ),
        grid_suitability TEXT CHECK (
          grid_suitability IS NULL OR grid_suitability IN ('SUITABLE', 'UNSUITABLE', 'UNKNOWN')
        ),
        roof_direction TEXT CHECK (
          roof_direction IS NULL OR roof_direction IN ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'UNKNOWN')
        ),
        roof_tilt_degrees REAL CHECK (roof_tilt_degrees IS NULL OR roof_tilt_degrees BETWEEN 0 AND 90),
        cable_distance_meters REAL CHECK (
          cable_distance_meters IS NULL OR cable_distance_meters >= 0
        ),
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
          status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')
        ),
        submitted_at TEXT,
        reviewed_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (id, lead_id)
      );
      CREATE INDEX IF NOT EXISTS idx_surveys_lead_status
        ON surveys(lead_id, status, created_at);

      CREATE TABLE IF NOT EXISTS survey_approvals (
        id TEXT PRIMARY KEY NOT NULL,
        survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE RESTRICT,
        reviewer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
        notes TEXT NOT NULL DEFAULT '',
        decided_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_survey_approvals_survey
        ON survey_approvals(survey_id, decided_at);

      CREATE TABLE IF NOT EXISTS package_templates (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        system_type TEXT NOT NULL CHECK (
          system_type IN ('SOLAR_PANEL_SET', 'ON_GRID', 'OFF_GRID', 'INSTALLATION_SERVICE')
        ),
        description TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (name, system_type)
      );

      CREATE TABLE IF NOT EXISTS package_template_items (
        id TEXT PRIMARY KEY NOT NULL,
        template_id TEXT NOT NULL REFERENCES package_templates(id) ON DELETE CASCADE,
        component_code TEXT NOT NULL CHECK (
          component_code IN (
            'PANELS', 'CONNECTORS', 'WIRES', 'INVERTER', 'WIRING_BOXES',
            'CHARGE_CONTROLLER', 'SAFETY_EARTHING', 'METAL_STANDS',
            'LARGE_BATTERY', 'SWITCHES', 'SAFETY_PARTS', 'INSTALLATION_SERVICE'
          )
        ),
        description TEXT NOT NULL,
        quantity REAL CHECK (quantity IS NULL OR quantity > 0),
        unit TEXT NOT NULL DEFAULT 'unit',
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (template_id, component_code)
      );
      CREATE INDEX IF NOT EXISTS idx_package_template_items_template
        ON package_template_items(template_id, sort_order);

      CREATE TABLE IF NOT EXISTS quotations (
        id TEXT PRIMARY KEY NOT NULL,
        quote_number TEXT NOT NULL UNIQUE,
        lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
        survey_id TEXT NOT NULL,
        package_template_id TEXT REFERENCES package_templates(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
          status IN ('DRAFT', 'PENDING', 'RELEASED', 'ACCEPTED', 'REJECTED', 'EXPIRED')
        ),
        currency_code TEXT CHECK (currency_code IS NULL OR length(currency_code) = 3),
        terms TEXT NOT NULL DEFAULT '',
        issued_at TEXT,
        expires_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (survey_id, lead_id) REFERENCES surveys(id, lead_id) ON DELETE RESTRICT,
        UNIQUE (id, lead_id)
      );
      CREATE INDEX IF NOT EXISTS idx_quotations_lead_status
        ON quotations(lead_id, status, created_at);

      CREATE TABLE IF NOT EXISTS quotation_items (
        id TEXT PRIMARY KEY NOT NULL,
        quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        template_item_id TEXT REFERENCES package_template_items(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL CHECK (quantity > 0),
        unit TEXT NOT NULL DEFAULT 'unit',
        unit_price REAL CHECK (unit_price IS NULL OR unit_price >= 0),
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (quotation_id, sort_order)
      );
      CREATE INDEX IF NOT EXISTS idx_quotation_items_quote
        ON quotation_items(quotation_id, sort_order);

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY NOT NULL,
        order_number TEXT NOT NULL UNIQUE,
        quote_id TEXT NOT NULL UNIQUE REFERENCES quotations(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
          status IN ('DRAFT', 'CONFIRMED', 'CANCELLED', 'COMPLETED')
        ),
        required_advance_amount REAL CHECK (
          required_advance_amount IS NULL OR required_advance_amount > 0
        ),
        confirmed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY NOT NULL,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
        payment_type TEXT NOT NULL CHECK (payment_type IN ('ADVANCE', 'FULL')),
        amount REAL NOT NULL CHECK (amount > 0),
        method TEXT CHECK (
          method IS NULL OR method IN ('BANK_TRANSFER', 'UPI', 'CASH', 'CARD', 'OTHER')
        ),
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
          status IN ('PENDING', 'RECORDED', 'VOID')
        ),
        reference TEXT UNIQUE,
        recorded_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (status <> 'RECORDED' OR recorded_at IS NOT NULL)
      );
      CREATE INDEX IF NOT EXISTS idx_payments_order_status
        ON payments(order_id, status, payment_type);

      CREATE TABLE IF NOT EXISTS warehouses (
        id TEXT PRIMARY KEY NOT NULL,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        address TEXT,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        product_type TEXT NOT NULL CHECK (
          product_type IN (
            'PANEL', 'CONNECTOR', 'WIRE', 'INVERTER', 'WIRING_BOXES',
            'CHARGE_CONTROLLER', 'SAFETY_EARTHING', 'METAL_STAND',
            'BATTERY', 'SWITCH', 'SAFETY_PART', 'INSTALLATION_SERVICE', 'OTHER'
          )
        ),
        unit TEXT NOT NULL DEFAULT 'unit',
        tracks_serial INTEGER NOT NULL DEFAULT 0 CHECK (tracks_serial IN (0, 1)),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (
          product_type NOT IN ('INVERTER', 'BATTERY', 'CHARGE_CONTROLLER')
          OR tracks_serial = 1
        )
      );

      CREATE TABLE IF NOT EXISTS stock_balances (
        warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
        inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
        quantity_on_hand REAL NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
        quantity_reserved REAL NOT NULL DEFAULT 0 CHECK (
          quantity_reserved >= 0 AND quantity_reserved <= quantity_on_hand
        ),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (warehouse_id, inventory_item_id)
      );

      CREATE TABLE IF NOT EXISTS product_serials (
        id TEXT PRIMARY KEY NOT NULL,
        inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
        warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
        serial_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK (
          status IN ('IN_STOCK', 'RESERVED', 'PICKED', 'DELIVERED', 'INSTALLED', 'RETURNED', 'SCRAPPED')
        ),
        received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_product_serials_item_warehouse
        ON product_serials(inventory_item_id, warehouse_id, status);

      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY NOT NULL,
        warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
        inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
        serial_id TEXT REFERENCES product_serials(id) ON DELETE RESTRICT,
        movement_type TEXT NOT NULL CHECK (
          movement_type IN ('RECEIPT', 'ISSUE', 'RESERVE', 'UNRESERVE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT')
        ),
        quantity REAL NOT NULL CHECK (quantity > 0),
        reference_type TEXT,
        reference_id TEXT,
        note TEXT NOT NULL DEFAULT '',
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_stock_movements_item_date
        ON stock_movements(inventory_item_id, warehouse_id, created_at);

      CREATE TABLE IF NOT EXISTS dispatches (
        id TEXT PRIMARY KEY NOT NULL,
        dispatch_number TEXT NOT NULL UNIQUE,
        order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
        warehouse_id TEXT REFERENCES warehouses(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'PICKING' CHECK (
          status IN ('PICKING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED')
        ),
        departed_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (status <> 'DELIVERED' OR completed_at IS NOT NULL)
      );

      CREATE TABLE IF NOT EXISTS dispatch_serials (
        dispatch_id TEXT NOT NULL REFERENCES dispatches(id) ON DELETE RESTRICT,
        product_serial_id TEXT NOT NULL UNIQUE REFERENCES product_serials(id) ON DELETE RESTRICT,
        delivery_completed_at TEXT,
        PRIMARY KEY (dispatch_id, product_serial_id),
        CHECK (delivery_completed_at IS NULL OR length(delivery_completed_at) >= 10)
      );

      CREATE TABLE IF NOT EXISTS installation_jobs (
        id TEXT PRIMARY KEY NOT NULL,
        job_number TEXT NOT NULL UNIQUE,
        order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (
          status IN ('SCHEDULED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
        ),
        scheduled_start TEXT,
        scheduled_end TEXT,
        started_at TEXT,
        completed_at TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (scheduled_end IS NULL OR scheduled_start IS NULL OR scheduled_end > scheduled_start),
        CHECK (status NOT IN ('IN_PROGRESS', 'COMPLETED') OR started_at IS NOT NULL),
        CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL)
      );
      CREATE INDEX IF NOT EXISTS idx_installation_jobs_status_schedule
        ON installation_jobs(status, scheduled_start);

      CREATE TABLE IF NOT EXISTS installation_assignments (
        job_id TEXT NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
        technician_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        assignment_role TEXT NOT NULL DEFAULT 'TECHNICIAN',
        assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (job_id, technician_user_id)
      );

      CREATE TABLE IF NOT EXISTS installation_time_logs (
        id TEXT PRIMARY KEY NOT NULL,
        job_id TEXT NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
        technician_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        hours REAL CHECK (hours IS NULL OR hours > 0),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (ended_at IS NULL OR ended_at > started_at)
      );
      CREATE INDEX IF NOT EXISTS idx_installation_time_logs_job
        ON installation_time_logs(job_id, technician_user_id, started_at);

      CREATE TABLE IF NOT EXISTS installation_checklists (
        id TEXT PRIMARY KEY NOT NULL,
        job_id TEXT NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
        check_code TEXT NOT NULL,
        description TEXT NOT NULL,
        is_complete INTEGER NOT NULL DEFAULT 0 CHECK (is_complete IN (0, 1)),
        completed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        completed_at TEXT,
        notes TEXT NOT NULL DEFAULT '',
        UNIQUE (job_id, check_code)
      );

      CREATE TABLE IF NOT EXISTS customer_signoffs (
        id TEXT PRIMARY KEY NOT NULL,
        job_id TEXT NOT NULL UNIQUE REFERENCES installation_jobs(id) ON DELETE RESTRICT,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        signature_file_id TEXT REFERENCES stored_files(id) ON DELETE RESTRICT,
        customer_name TEXT NOT NULL,
        signed_at TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT ''
      );
    `)

    database.exec(`
      INSERT OR IGNORE INTO leads (
        id, lead_number, customer_id, status, assigned_to, source, notes, created_at, updated_at
      )
      SELECT 'lead-' || c.id, 'LD-' || c.id, c.id, c.lead_status, c.assigned_to, 'UNKNOWN',
             c.notes, c.created_at, c.updated_at
      FROM customers c;
    `)

    const existingFollowUps = objectType(database, 'customer_follow_ups')
    if (existingFollowUps === 'table') {
      if (objectType(database, 'customer_follow_ups_legacy_v1')) {
        throw new Error('Legacy customer follow-up archive already exists; refusing to rename or overwrite it.')
      }
      database.exec('ALTER TABLE customer_follow_ups RENAME TO customer_follow_ups_legacy_v1')
    } else if (existingFollowUps && existingFollowUps !== 'view') {
      throw new Error(`Unexpected customer_follow_ups schema object: ${existingFollowUps}.`)
    }

    database.exec(`
      CREATE TABLE IF NOT EXISTS follow_ups (
        id TEXT PRIMARY KEY NOT NULL,
        lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        assigned_to TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        due_at TEXT NOT NULL CHECK (julianday(due_at) IS NOT NULL),
        note TEXT NOT NULL CHECK (length(trim(note)) BETWEEN 1 AND 2000),
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_due
        ON follow_ups(lead_id, completed_at, due_at);
    `)

    if (existingFollowUps === 'table') {
      database.exec(`
        INSERT OR IGNORE INTO follow_ups (
          id, lead_id, assigned_to, created_by, due_at, note, completed_at, created_at, updated_at
        )
        SELECT old.id, leads.id, old.assigned_to, old.created_by, old.due_at, old.note,
               old.completed_at, old.created_at, old.updated_at
        FROM customer_follow_ups_legacy_v1 old
        JOIN leads ON leads.customer_id = old.customer_id
      `)
    }

    database.exec(`
      CREATE VIEW customer_follow_ups AS
      SELECT f.id,
             lead.customer_id,
             f.assigned_to,
             f.created_by,
             f.due_at,
             f.note,
             f.completed_at,
             f.created_at,
             f.updated_at
      FROM follow_ups f
      JOIN leads lead ON lead.id = f.lead_id;

      CREATE TRIGGER customer_follow_ups_insert
      INSTEAD OF INSERT ON customer_follow_ups
      BEGIN
        SELECT RAISE(ABORT, 'customer has no lead')
        WHERE NOT EXISTS (SELECT 1 FROM leads WHERE customer_id = NEW.customer_id);
        INSERT INTO follow_ups (
          id, lead_id, assigned_to, created_by, due_at, note, completed_at, created_at, updated_at
        )
        SELECT NEW.id, lead.id, NEW.assigned_to, NEW.created_by, NEW.due_at, NEW.note,
               NEW.completed_at,
               COALESCE(NEW.created_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
               COALESCE(NEW.updated_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        FROM leads lead
        WHERE lead.customer_id = NEW.customer_id;
      END;

      CREATE TRIGGER customer_follow_ups_update
      INSTEAD OF UPDATE ON customer_follow_ups
      BEGIN
        UPDATE follow_ups
        SET assigned_to = NEW.assigned_to,
            created_by = NEW.created_by,
            due_at = NEW.due_at,
            note = NEW.note,
            completed_at = NEW.completed_at,
            updated_at = COALESCE(NEW.updated_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = OLD.id;
      END;

      CREATE TRIGGER customer_follow_ups_delete
      INSTEAD OF DELETE ON customer_follow_ups
      BEGIN
        DELETE FROM follow_ups WHERE id = OLD.id;
      END;
    `)

    database.exec(`
      CREATE TRIGGER customers_create_lead
      AFTER INSERT ON customers
      BEGIN
        INSERT INTO leads (id, lead_number, customer_id, status, assigned_to, source, notes)
        VALUES ('lead-' || NEW.id, 'LD-' || NEW.id, NEW.id, NEW.lead_status, NEW.assigned_to, 'UNKNOWN', NEW.notes)
        ON CONFLICT(customer_id) DO UPDATE SET
          status = excluded.status,
          assigned_to = excluded.assigned_to,
          notes = excluded.notes,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
      END;

      CREATE TRIGGER customers_update_lead
      AFTER UPDATE OF lead_status, assigned_to, notes ON customers
      WHEN EXISTS (
        SELECT 1 FROM leads
        WHERE customer_id = NEW.id
          AND (
            status IS NOT NEW.lead_status
            OR assigned_to IS NOT NEW.assigned_to
            OR notes IS NOT NEW.notes
          )
      )
      BEGIN
        UPDATE leads
        SET status = NEW.lead_status,
            assigned_to = NEW.assigned_to,
            notes = NEW.notes,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE customer_id = NEW.id;
      END;

      CREATE TRIGGER leads_update_customer
      AFTER UPDATE OF status, assigned_to, notes ON leads
      WHEN EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id
          AND (
            lead_status IS NOT NEW.status
            OR assigned_to IS NOT NEW.assigned_to
            OR notes IS NOT NEW.notes
          )
      )
      BEGIN
        UPDATE customers
        SET lead_status = NEW.status,
            assigned_to = NEW.assigned_to,
            notes = NEW.notes,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = NEW.customer_id;
      END;
    `)

    database.exec(`
      CREATE TABLE IF NOT EXISTS survey_attachments (
        id TEXT PRIMARY KEY NOT NULL,
        survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
        file_id TEXT NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
        attachment_type TEXT NOT NULL DEFAULT 'ROOF_PHOTO' CHECK (
          attachment_type IN ('ROOF_PHOTO', 'ELECTRICAL_PHOTO', 'DOCUMENT', 'OTHER')
        ),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (survey_id, file_id)
      );

      CREATE TABLE IF NOT EXISTS installation_attachments (
        id TEXT PRIMARY KEY NOT NULL,
        job_id TEXT NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
        file_id TEXT NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
        attachment_type TEXT NOT NULL DEFAULT 'INSTALLATION_PHOTO' CHECK (
          attachment_type IN ('INSTALLATION_PHOTO', 'TEST_RESULT', 'OTHER')
        ),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (job_id, file_id)
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY NOT NULL,
        invoice_number TEXT NOT NULL UNIQUE,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
          status IN ('DRAFT', 'ISSUED', 'PART_PAID', 'PAID', 'VOID')
        ),
        issued_at TEXT,
        due_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY NOT NULL,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity REAL NOT NULL CHECK (quantity > 0),
        unit TEXT NOT NULL DEFAULT 'unit',
        unit_price REAL NOT NULL CHECK (unit_price >= 0),
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (invoice_id, sort_order)
      );

      CREATE TABLE IF NOT EXISTS stock_purchases (
        id TEXT PRIMARY KEY NOT NULL,
        purchase_number TEXT NOT NULL UNIQUE,
        warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        supplier_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
          status IN ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED')
        ),
        purchased_at TEXT,
        received_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS stock_purchase_items (
        id TEXT PRIMARY KEY NOT NULL,
        purchase_id TEXT NOT NULL REFERENCES stock_purchases(id) ON DELETE CASCADE,
        inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL CHECK (quantity > 0),
        unit_cost REAL CHECK (unit_cost IS NULL OR unit_cost >= 0),
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (purchase_id, sort_order)
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY NOT NULL,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        expense_type TEXT NOT NULL CHECK (
          expense_type IN ('TRAVEL', 'PERMIT', 'MATERIAL', 'SERVICE', 'OTHER')
        ),
        description TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount >= 0),
        incurred_at TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS technician_payroll_entries (
        id TEXT PRIMARY KEY NOT NULL,
        job_id TEXT NOT NULL REFERENCES installation_jobs(id) ON DELETE RESTRICT,
        technician_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        hours REAL NOT NULL CHECK (hours > 0),
        hourly_rate REAL CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
        amount REAL CHECK (amount IS NULL OR amount >= 0),
        paid_at TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS subsidy_cases (
        id TEXT PRIMARY KEY NOT NULL,
        case_number TEXT NOT NULL UNIQUE,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        program_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
          status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID')
        ),
        requested_amount REAL CHECK (requested_amount IS NULL OR requested_amount >= 0),
        approved_amount REAL CHECK (approved_amount IS NULL OR approved_amount >= 0),
        submitted_at TEXT,
        decided_at TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (approved_amount IS NULL OR requested_amount IS NULL OR approved_amount <= requested_amount)
      );

      CREATE TABLE IF NOT EXISTS subsidy_documents (
        id TEXT PRIMARY KEY NOT NULL,
        subsidy_case_id TEXT NOT NULL REFERENCES subsidy_cases(id) ON DELETE CASCADE,
        file_id TEXT NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
        document_type TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (subsidy_case_id, file_id)
      );
    `)
  },
}
