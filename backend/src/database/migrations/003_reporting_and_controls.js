const WARRANTY_RULES = [
  ['PANEL', 20, 1, 'Solar panel warranty: 20 years from completed delivery'],
  ['INVERTER', 2, 1, 'Inverter warranty: 2 years from completed delivery'],
  ['BATTERY', 2, 1, 'Battery warranty: 2 years from completed delivery'],
  ['CHARGE_CONTROLLER', null, 0, 'Charge-controller warranty duration is not specified'],
]

export const reportingMigration = {
  version: 3,
  name: 'workflow_controls_warranties_and_reporting',

  up(database) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS warranty_rules (
        product_type TEXT PRIMARY KEY,
        duration_years REAL CHECK (duration_years IS NULL OR duration_years > 0),
        duration_specified INTEGER NOT NULL CHECK (duration_specified IN (0, 1)),
        rule_note TEXT NOT NULL,
        CHECK (
          (duration_specified = 1 AND duration_years IS NOT NULL)
          OR (duration_specified = 0 AND duration_years IS NULL)
        )
      );

      CREATE TABLE IF NOT EXISTS warranty_records (
        id TEXT PRIMARY KEY NOT NULL,
        product_serial_id TEXT NOT NULL UNIQUE REFERENCES product_serials(id) ON DELETE RESTRICT,
        product_type TEXT NOT NULL REFERENCES warranty_rules(product_type) ON DELETE RESTRICT,
        duration_years REAL CHECK (duration_years IS NULL OR duration_years > 0),
        starts_on TEXT NOT NULL,
        ends_on TEXT,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'UNSPECIFIED')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (
          (duration_years IS NULL AND ends_on IS NULL AND status = 'UNSPECIFIED')
          OR (duration_years IS NOT NULL AND ends_on IS NOT NULL AND status = 'ACTIVE')
        )
      );
      CREATE INDEX IF NOT EXISTS idx_warranty_records_status_end
        ON warranty_records(status, ends_on);

      CREATE TABLE IF NOT EXISTS service_tickets (
        id TEXT PRIMARY KEY NOT NULL,
        ticket_number TEXT NOT NULL UNIQUE,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (
          status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED')
        ),
        opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        closed_at TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL)
      );
      CREATE INDEX IF NOT EXISTS idx_service_tickets_customer_status
        ON service_tickets(customer_id, status, opened_at);

      CREATE TABLE IF NOT EXISTS service_ticket_items (
        id TEXT PRIMARY KEY NOT NULL,
        ticket_id TEXT NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
        product_serial_id TEXT NOT NULL REFERENCES product_serials(id) ON DELETE RESTRICT,
        symptom TEXT NOT NULL DEFAULT '',
        UNIQUE (ticket_id, product_serial_id)
      );
      CREATE INDEX IF NOT EXISTS idx_service_ticket_items_serial
        ON service_ticket_items(product_serial_id);

      CREATE TABLE IF NOT EXISTS service_resolutions (
        id TEXT PRIMARY KEY NOT NULL,
        ticket_id TEXT NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
        resolution_type TEXT NOT NULL CHECK (
          resolution_type IN ('REPAIR', 'REPLACEMENT', 'ADVICE', 'NO_FAULT_FOUND', 'OTHER')
        ),
        warranty_coverage TEXT NOT NULL CHECK (
          warranty_coverage IN ('COVERED', 'NOT_COVERED', 'UNSPECIFIED')
        ),
        parts_charge REAL CHECK (parts_charge IS NULL OR parts_charge >= 0),
        labour_charge REAL CHECK (labour_charge IS NULL OR labour_charge >= 0),
        notes TEXT NOT NULL DEFAULT '',
        resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (
          warranty_coverage <> 'COVERED'
          OR (COALESCE(parts_charge, 0) = 0 AND COALESCE(labour_charge, 0) = 0)
        )
      );
      CREATE INDEX IF NOT EXISTS idx_service_resolutions_ticket
        ON service_resolutions(ticket_id, resolved_at);

      CREATE TABLE IF NOT EXISTS customer_service_confirmations (
        id TEXT PRIMARY KEY NOT NULL,
        ticket_id TEXT NOT NULL UNIQUE REFERENCES service_tickets(id) ON DELETE RESTRICT,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        confirmed INTEGER NOT NULL CHECK (confirmed IN (0, 1)),
        confirmed_at TEXT,
        notes TEXT NOT NULL DEFAULT '',
        CHECK (confirmed = 0 OR confirmed_at IS NOT NULL)
      );

      CREATE TABLE IF NOT EXISTS service_attachments (
        id TEXT PRIMARY KEY NOT NULL,
        ticket_id TEXT NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
        file_id TEXT NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
        attachment_type TEXT NOT NULL DEFAULT 'SERVICE_PHOTO' CHECK (
          attachment_type IN ('SERVICE_PHOTO', 'DOCUMENT', 'OTHER')
        ),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (ticket_id, file_id)
      );

      CREATE TRIGGER IF NOT EXISTS customer_user_insert_profile
      AFTER INSERT ON users
      WHEN NEW.role = 'CUSTOMER'
      BEGIN
        INSERT OR IGNORE INTO customers (
          id, linked_user_id, full_name, email, phone, address
        ) VALUES (
          'customer-' || NEW.id, NEW.id, NEW.full_name, NEW.email, NEW.phone, NEW.address
        );
      END;

      CREATE TRIGGER IF NOT EXISTS customer_user_update_profile
      AFTER UPDATE OF role, full_name, email, phone, address ON users
      WHEN NEW.role = 'CUSTOMER'
      BEGIN
        INSERT OR IGNORE INTO customers (
          id, linked_user_id, full_name, email, phone, address
        ) VALUES (
          'customer-' || NEW.id, NEW.id, NEW.full_name, NEW.email, NEW.phone, NEW.address
        );
        UPDATE customers
        SET full_name = NEW.full_name,
            email = NEW.email,
            phone = NEW.phone,
            address = NEW.address,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE linked_user_id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS survey_approval_reviewer_role
      BEFORE INSERT ON survey_approvals
      WHEN NEW.reviewer_user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM users
          WHERE id = NEW.reviewer_user_id AND role = 'ADMIN' AND is_active = 1
        )
      BEGIN
        SELECT RAISE(ABORT, 'Only an active administrator may approve a survey');
      END;

      CREATE TRIGGER IF NOT EXISTS survey_status_requires_approval
      BEFORE UPDATE OF status ON surveys
      WHEN NEW.status IN ('APPROVED', 'REJECTED')
        AND NOT EXISTS (
          SELECT 1 FROM survey_approvals
          WHERE survey_id = NEW.id AND decision = NEW.status
        )
      BEGIN
        SELECT RAISE(ABORT, 'Survey status requires a matching approval record');
      END;

      CREATE TRIGGER IF NOT EXISTS survey_approval_sets_status
      AFTER INSERT ON survey_approvals
      BEGIN
        UPDATE surveys
        SET status = NEW.decision,
            reviewed_at = NEW.decided_at,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = NEW.survey_id;
      END;

      CREATE TRIGGER IF NOT EXISTS quotation_release_requires_approved_survey_insert
      BEFORE INSERT ON quotations
      WHEN NEW.status IN ('RELEASED', 'ACCEPTED')
        AND NOT EXISTS (
          SELECT 1 FROM surveys
          WHERE id = NEW.survey_id AND lead_id = NEW.lead_id AND status = 'APPROVED'
        )
      BEGIN
        SELECT RAISE(ABORT, 'A quotation cannot be released before its survey is approved');
      END;

      CREATE TRIGGER IF NOT EXISTS quotation_release_requires_approved_survey_update
      BEFORE UPDATE OF status, survey_id, lead_id ON quotations
      WHEN NEW.status IN ('RELEASED', 'ACCEPTED')
        AND NOT EXISTS (
          SELECT 1 FROM surveys
          WHERE id = NEW.survey_id AND lead_id = NEW.lead_id AND status = 'APPROVED'
        )
      BEGIN
        SELECT RAISE(ABORT, 'A quotation cannot be released before its survey is approved');
      END;

      CREATE TRIGGER IF NOT EXISTS order_confirmation_requires_released_quote_insert
      BEFORE INSERT ON orders
      WHEN NEW.status = 'CONFIRMED'
        AND NOT EXISTS (
          SELECT 1 FROM quotations
          WHERE id = NEW.quote_id AND status IN ('RELEASED', 'ACCEPTED')
        )
      BEGIN
        SELECT RAISE(ABORT, 'An order requires a released quotation');
      END;

      CREATE TRIGGER IF NOT EXISTS order_confirmation_requires_released_quote_update
      BEFORE UPDATE OF status, quote_id ON orders
      WHEN NEW.status = 'CONFIRMED'
        AND NOT EXISTS (
          SELECT 1 FROM quotations
          WHERE id = NEW.quote_id AND status IN ('RELEASED', 'ACCEPTED')
        )
      BEGIN
        SELECT RAISE(ABORT, 'An order requires a released quotation');
      END;

      CREATE TRIGGER IF NOT EXISTS confirmed_order_creates_workflows_insert
      AFTER INSERT ON orders
      WHEN NEW.status = 'CONFIRMED'
      BEGIN
        INSERT OR IGNORE INTO dispatches (id, dispatch_number, order_id)
        VALUES ('dispatch-' || NEW.id, 'DSP-' || NEW.order_number, NEW.id);
        INSERT OR IGNORE INTO installation_jobs (id, job_number, order_id)
        VALUES ('installation-' || NEW.id, 'INS-' || NEW.order_number, NEW.id);
      END;

      CREATE TRIGGER IF NOT EXISTS confirmed_order_creates_workflows_update
      AFTER UPDATE OF status ON orders
      WHEN NEW.status = 'CONFIRMED' AND OLD.status <> 'CONFIRMED'
      BEGIN
        INSERT OR IGNORE INTO dispatches (id, dispatch_number, order_id)
        VALUES ('dispatch-' || NEW.id, 'DSP-' || NEW.order_number, NEW.id);
        INSERT OR IGNORE INTO installation_jobs (id, job_number, order_id)
        VALUES ('installation-' || NEW.id, 'INS-' || NEW.order_number, NEW.id);
      END;

      CREATE TRIGGER IF NOT EXISTS full_payment_requires_priced_quote_insert
      BEFORE INSERT ON payments
      WHEN NEW.status = 'RECORDED' AND NEW.payment_type = 'FULL'
        AND NOT EXISTS (
          SELECT 1
          FROM orders o
          JOIN quotation_items qi ON qi.quotation_id = (
            SELECT quote_id FROM orders WHERE id = NEW.order_id
          )
          WHERE o.id = NEW.order_id
          GROUP BY o.id
          HAVING COUNT(*) > 0
            AND COUNT(qi.unit_price) = COUNT(*)
            AND NEW.amount >= SUM(qi.quantity * qi.unit_price)
        )
      BEGIN
        SELECT RAISE(ABORT, 'A recorded full payment must cover a fully priced quotation');
      END;

      CREATE TRIGGER IF NOT EXISTS full_payment_requires_priced_quote_update
      BEFORE UPDATE OF status, payment_type, amount, order_id ON payments
      WHEN NEW.status = 'RECORDED' AND NEW.payment_type = 'FULL'
        AND NOT EXISTS (
          SELECT 1
          FROM orders o
          JOIN quotation_items qi ON qi.quotation_id = (
            SELECT quote_id FROM orders WHERE id = NEW.order_id
          )
          WHERE o.id = NEW.order_id
          GROUP BY o.id
          HAVING COUNT(*) > 0
            AND COUNT(qi.unit_price) = COUNT(*)
            AND NEW.amount >= SUM(qi.quantity * qi.unit_price)
        )
      BEGIN
        SELECT RAISE(ABORT, 'A recorded full payment must cover a fully priced quotation');
      END;

      CREATE TRIGGER IF NOT EXISTS installation_start_requires_payment_insert
      BEFORE INSERT ON installation_jobs
      WHEN NEW.status IN ('IN_PROGRESS', 'COMPLETED')
        AND NOT EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.id = NEW.order_id
            AND (
              EXISTS (
                SELECT 1 FROM payments p
                WHERE p.order_id = o.id AND p.payment_type = 'FULL' AND p.status = 'RECORDED'
                  AND p.amount >= (
                    SELECT SUM(qi.quantity * qi.unit_price)
                    FROM quotations q JOIN quotation_items qi ON qi.quotation_id = q.id
                    WHERE q.id = o.quote_id
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM quotation_items qi
                    WHERE qi.quotation_id = o.quote_id AND qi.unit_price IS NULL
                  )
              )
              OR (
                o.required_advance_amount IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM payments p
                  WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE' AND p.status = 'RECORDED'
                )
                AND (
                  SELECT COALESCE(SUM(p.amount), 0) FROM payments p
                  WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE' AND p.status = 'RECORDED'
                ) >= o.required_advance_amount
              )
            )
        )
      BEGIN
        SELECT RAISE(ABORT, 'Installation cannot start before the required advance or full payment is recorded');
      END;

      CREATE TRIGGER IF NOT EXISTS installation_start_requires_payment_update
      BEFORE UPDATE OF status ON installation_jobs
      WHEN NEW.status IN ('IN_PROGRESS', 'COMPLETED')
        AND NOT EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.id = NEW.order_id
            AND (
              EXISTS (
                SELECT 1 FROM payments p
                WHERE p.order_id = o.id AND p.payment_type = 'FULL' AND p.status = 'RECORDED'
                  AND p.amount >= (
                    SELECT SUM(qi.quantity * qi.unit_price)
                    FROM quotations q JOIN quotation_items qi ON qi.quotation_id = q.id
                    WHERE q.id = o.quote_id
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM quotation_items qi
                    WHERE qi.quotation_id = o.quote_id AND qi.unit_price IS NULL
                  )
              )
              OR (
                o.required_advance_amount IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM payments p
                  WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE' AND p.status = 'RECORDED'
                )
                AND (
                  SELECT COALESCE(SUM(p.amount), 0) FROM payments p
                  WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE' AND p.status = 'RECORDED'
                ) >= o.required_advance_amount
              )
            )
        )
      BEGIN
        SELECT RAISE(ABORT, 'Installation cannot start before the required advance or full payment is recorded');
      END;

      CREATE TRIGGER IF NOT EXISTS technician_assignment_requires_technician
      BEFORE INSERT ON installation_assignments
      WHEN NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.technician_user_id AND role = 'TECHNICIAN' AND is_active = 1
      )
      BEGIN
        SELECT RAISE(ABORT, 'Installation assignments require an active technician account');
      END;

      CREATE TRIGGER IF NOT EXISTS technician_time_log_requires_technician
      BEFORE INSERT ON installation_time_logs
      WHEN NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.technician_user_id AND role = 'TECHNICIAN' AND is_active = 1
      )
      BEGIN
        SELECT RAISE(ABORT, 'Time logs require an active technician account');
      END;

      CREATE TRIGGER IF NOT EXISTS technician_payroll_requires_technician
      BEFORE INSERT ON technician_payroll_entries
      WHEN NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.technician_user_id AND role = 'TECHNICIAN' AND is_active = 1
      )
      BEGIN
        SELECT RAISE(ABORT, 'Payroll entries require an active technician account');
      END;

      CREATE TRIGGER IF NOT EXISTS active_package_templates_require_bom_insert
      BEFORE INSERT ON package_templates
      WHEN NEW.is_active = 1
      BEGIN
        SELECT RAISE(ABORT, 'Create package templates inactive, add required BOM items, then activate them');
      END;

      CREATE TRIGGER IF NOT EXISTS active_package_templates_require_bom_update
      BEFORE UPDATE OF system_type, is_active ON package_templates
      WHEN NEW.is_active = 1
        AND (
          (NEW.system_type = 'SOLAR_PANEL_SET' AND (
            NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'PANELS')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'CONNECTORS')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'WIRES')
          ))
          OR (NEW.system_type = 'ON_GRID' AND (
            NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'INVERTER')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'WIRING_BOXES')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'CHARGE_CONTROLLER')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'PANELS')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'SAFETY_EARTHING')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'METAL_STANDS')
          ))
          OR (NEW.system_type = 'OFF_GRID' AND (
            NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'INVERTER')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'WIRING_BOXES')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'CHARGE_CONTROLLER')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'PANELS')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'SAFETY_EARTHING')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'METAL_STANDS')
            OR NOT EXISTS (SELECT 1 FROM package_template_items WHERE template_id = NEW.id AND component_code = 'LARGE_BATTERY')
          ))
          OR (NEW.system_type = 'INSTALLATION_SERVICE' AND
            NOT EXISTS (
              SELECT 1 FROM package_template_items
              WHERE template_id = NEW.id AND component_code = 'INSTALLATION_SERVICE'
            )
          )
        )
      BEGIN
        SELECT RAISE(ABORT, 'Package template is missing one or more required BOM components');
      END;

      CREATE TRIGGER IF NOT EXISTS active_package_template_item_delete
      BEFORE DELETE ON package_template_items
      WHEN EXISTS (
        SELECT 1 FROM package_templates t
        WHERE t.id = OLD.template_id AND t.is_active = 1
          AND (
            (t.system_type = 'SOLAR_PANEL_SET' AND OLD.component_code IN ('PANELS', 'CONNECTORS', 'WIRES'))
            OR (t.system_type = 'ON_GRID' AND OLD.component_code IN (
              'INVERTER', 'WIRING_BOXES', 'CHARGE_CONTROLLER', 'PANELS', 'SAFETY_EARTHING', 'METAL_STANDS'
            ))
            OR (t.system_type = 'OFF_GRID' AND OLD.component_code IN (
              'INVERTER', 'WIRING_BOXES', 'CHARGE_CONTROLLER', 'PANELS', 'SAFETY_EARTHING', 'METAL_STANDS', 'LARGE_BATTERY'
            ))
            OR (t.system_type = 'INSTALLATION_SERVICE' AND OLD.component_code = 'INSTALLATION_SERVICE')
          )
      )
      BEGIN
        SELECT RAISE(ABORT, 'Deactivate a package template before removing a required BOM component');
      END;

      CREATE TRIGGER IF NOT EXISTS active_package_template_item_update
      BEFORE UPDATE OF template_id, component_code ON package_template_items
      WHEN EXISTS (
        SELECT 1 FROM package_templates t
        WHERE t.id = OLD.template_id AND t.is_active = 1
          AND (
            (t.system_type = 'SOLAR_PANEL_SET' AND OLD.component_code IN ('PANELS', 'CONNECTORS', 'WIRES'))
            OR (t.system_type = 'ON_GRID' AND OLD.component_code IN (
              'INVERTER', 'WIRING_BOXES', 'CHARGE_CONTROLLER', 'PANELS', 'SAFETY_EARTHING', 'METAL_STANDS'
            ))
            OR (t.system_type = 'OFF_GRID' AND OLD.component_code IN (
              'INVERTER', 'WIRING_BOXES', 'CHARGE_CONTROLLER', 'PANELS', 'SAFETY_EARTHING', 'METAL_STANDS', 'LARGE_BATTERY'
            ))
            OR (t.system_type = 'INSTALLATION_SERVICE' AND OLD.component_code = 'INSTALLATION_SERVICE')
          )
      )
      BEGIN
        SELECT RAISE(ABORT, 'Deactivate a package template before changing a required BOM component');
      END;

      CREATE TRIGGER IF NOT EXISTS stock_movement_validates_serial
      BEFORE INSERT ON stock_movements
      WHEN EXISTS (
        SELECT 1 FROM inventory_items
        WHERE id = NEW.inventory_item_id AND tracks_serial = 1
      ) AND (
        NEW.serial_id IS NULL
        OR NEW.quantity <> 1
        OR NOT EXISTS (
          SELECT 1 FROM product_serials
          WHERE id = NEW.serial_id
            AND inventory_item_id = NEW.inventory_item_id
            AND warehouse_id = NEW.warehouse_id
        )
      )
      BEGIN
        SELECT RAISE(ABORT, 'Serialized stock movements require one matching product serial');
      END;

      CREATE TRIGGER IF NOT EXISTS stock_movement_serial_status
      BEFORE INSERT ON stock_movements
      WHEN NEW.serial_id IS NOT NULL
        AND NEW.movement_type IN ('ISSUE', 'RESERVE', 'ADJUSTMENT_OUT')
        AND NOT EXISTS (
          SELECT 1 FROM product_serials
          WHERE id = NEW.serial_id AND status IN ('IN_STOCK', 'RESERVED')
        )
      BEGIN
        SELECT RAISE(ABORT, 'Product serial is not available for this stock movement');
      END;

      CREATE TRIGGER IF NOT EXISTS stock_movement_checks_available_before_issue
      BEFORE INSERT ON stock_movements
      WHEN NEW.movement_type IN ('ISSUE', 'ADJUSTMENT_OUT', 'RESERVE')
        AND NEW.quantity > COALESCE((
          SELECT quantity_on_hand - quantity_reserved
          FROM stock_balances
          WHERE warehouse_id = NEW.warehouse_id
            AND inventory_item_id = NEW.inventory_item_id
        ), 0)
      BEGIN
        SELECT RAISE(ABORT, 'Insufficient available stock for movement');
      END;

      CREATE TRIGGER IF NOT EXISTS stock_movement_checks_reservation_before_release
      BEFORE INSERT ON stock_movements
      WHEN NEW.movement_type = 'UNRESERVE'
        AND NEW.quantity > COALESCE((
          SELECT quantity_reserved FROM stock_balances
          WHERE warehouse_id = NEW.warehouse_id AND inventory_item_id = NEW.inventory_item_id
        ), 0)
      BEGIN
        SELECT RAISE(ABORT, 'Cannot release more stock than is reserved');
      END;

      CREATE TRIGGER IF NOT EXISTS stock_movement_applies_balance
      AFTER INSERT ON stock_movements
      BEGIN
        INSERT INTO stock_balances (
          warehouse_id, inventory_item_id, quantity_on_hand, quantity_reserved, updated_at
        )
        VALUES (
          NEW.warehouse_id,
          NEW.inventory_item_id,
          CASE WHEN NEW.movement_type IN ('RECEIPT', 'ADJUSTMENT_IN') THEN NEW.quantity ELSE 0 END,
          CASE WHEN NEW.movement_type = 'RESERVE' THEN NEW.quantity ELSE 0 END,
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        ON CONFLICT(warehouse_id, inventory_item_id) DO UPDATE SET
          quantity_on_hand = quantity_on_hand
            + CASE
                WHEN NEW.movement_type IN ('RECEIPT', 'ADJUSTMENT_IN') THEN NEW.quantity
                WHEN NEW.movement_type IN ('ISSUE', 'ADJUSTMENT_OUT') THEN -NEW.quantity
                ELSE 0
              END,
          quantity_reserved = quantity_reserved
            + CASE
                WHEN NEW.movement_type = 'RESERVE' THEN NEW.quantity
                WHEN NEW.movement_type = 'UNRESERVE' THEN -NEW.quantity
                ELSE 0
              END,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

        UPDATE product_serials
        SET status = CASE NEW.movement_type
          WHEN 'RECEIPT' THEN 'IN_STOCK'
          WHEN 'RESERVE' THEN 'RESERVED'
          WHEN 'UNRESERVE' THEN 'IN_STOCK'
          WHEN 'ISSUE' THEN 'PICKED'
          WHEN 'ADJUSTMENT_OUT' THEN 'SCRAPPED'
          ELSE status
        END
        WHERE id = NEW.serial_id;
      END;

      CREATE TRIGGER IF NOT EXISTS stock_movements_immutable_update
      BEFORE UPDATE ON stock_movements
      BEGIN
        SELECT RAISE(ABORT, 'Stock movements are immutable; record a correcting movement');
      END;

      CREATE TRIGGER IF NOT EXISTS stock_movements_immutable_delete
      BEFORE DELETE ON stock_movements
      BEGIN
        SELECT RAISE(ABORT, 'Stock movements are immutable; record a correcting movement');
      END;

      CREATE TRIGGER IF NOT EXISTS dispatch_serial_validates_warehouse
      BEFORE INSERT ON dispatch_serials
      WHEN NOT EXISTS (
        SELECT 1
        FROM dispatches d
        JOIN product_serials s ON s.id = NEW.product_serial_id
        WHERE d.id = NEW.dispatch_id
          AND s.status IN ('IN_STOCK', 'RESERVED')
          AND (d.warehouse_id IS NULL OR d.warehouse_id = s.warehouse_id)
      )
      BEGIN
        SELECT RAISE(ABORT, 'Dispatch requires an available serial from the same warehouse');
      END;

      CREATE TRIGGER IF NOT EXISTS dispatch_serial_issues_stock
      AFTER INSERT ON dispatch_serials
      WHEN EXISTS (
        SELECT 1 FROM dispatches
        WHERE id = NEW.dispatch_id AND status IN ('DISPATCHED', 'DELIVERED')
      )
      BEGIN
        INSERT INTO stock_movements (
          id, warehouse_id, inventory_item_id, serial_id, movement_type,
          quantity, reference_type, reference_id
        )
        SELECT 'dispatch-issue-' || NEW.product_serial_id,
               s.warehouse_id, s.inventory_item_id, s.id, 'ISSUE', 1,
               'DISPATCH', NEW.dispatch_id
        FROM product_serials s
        WHERE s.id = NEW.product_serial_id
          AND NOT EXISTS (
            SELECT 1 FROM stock_movements
            WHERE reference_type = 'DISPATCH' AND reference_id = NEW.dispatch_id
              AND serial_id = NEW.product_serial_id
          );
      END;

      CREATE TRIGGER IF NOT EXISTS dispatch_dispatches_serials
      AFTER UPDATE OF status ON dispatches
      WHEN NEW.status = 'DISPATCHED' AND OLD.status <> 'DISPATCHED'
      BEGIN
        INSERT INTO stock_movements (
          id, warehouse_id, inventory_item_id, serial_id, movement_type,
          quantity, reference_type, reference_id
        )
        SELECT 'dispatch-issue-' || s.id,
               s.warehouse_id, s.inventory_item_id, s.id, 'ISSUE', 1,
               'DISPATCH', NEW.id
        FROM dispatch_serials ds
        JOIN product_serials s ON s.id = ds.product_serial_id
        WHERE ds.dispatch_id = NEW.id
          AND NOT EXISTS (
            SELECT 1 FROM stock_movements
            WHERE reference_type = 'DISPATCH' AND reference_id = NEW.id AND serial_id = s.id
          );
      END;

      CREATE TRIGGER IF NOT EXISTS dispatch_delivery_requires_departure
      BEFORE UPDATE OF status ON dispatches
      WHEN NEW.status = 'DELIVERED' AND OLD.status <> 'DELIVERED'
        AND OLD.status <> 'DISPATCHED'
      BEGIN
        SELECT RAISE(ABORT, 'Dispatch must depart before delivery can be completed');
      END;

      CREATE TRIGGER IF NOT EXISTS dispatch_serial_delivered_on_insert
      AFTER INSERT ON dispatch_serials
      WHEN EXISTS (
        SELECT 1 FROM dispatches
        WHERE id = NEW.dispatch_id AND status = 'DELIVERED'
      )
      BEGIN
        UPDATE dispatch_serials
        SET delivery_completed_at = (
          SELECT completed_at FROM dispatches WHERE id = NEW.dispatch_id
        )
        WHERE dispatch_id = NEW.dispatch_id
          AND product_serial_id = NEW.product_serial_id
          AND delivery_completed_at IS NULL;
      END;

      CREATE TRIGGER IF NOT EXISTS dispatch_delivery_date_immutable
      BEFORE UPDATE OF completed_at ON dispatches
      WHEN OLD.status = 'DELIVERED' AND NEW.completed_at IS NOT OLD.completed_at
      BEGIN
        SELECT RAISE(ABORT, 'Completed delivery dates are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS dispatch_delivery_updates_serials
      AFTER UPDATE OF status ON dispatches
      WHEN NEW.status = 'DELIVERED' AND OLD.status <> 'DELIVERED'
      BEGIN
        UPDATE dispatch_serials
        SET delivery_completed_at = NEW.completed_at
        WHERE dispatch_id = NEW.id AND delivery_completed_at IS NULL;
        UPDATE product_serials
        SET status = 'DELIVERED'
        WHERE id IN (SELECT product_serial_id FROM dispatch_serials WHERE dispatch_id = NEW.id);
      END;

      CREATE TRIGGER IF NOT EXISTS installation_signoff_customer_matches
      BEFORE INSERT ON customer_signoffs
      WHEN NOT EXISTS (
        SELECT 1
        FROM installation_jobs job
        JOIN orders o ON o.id = job.order_id
        JOIN quotations q ON q.id = o.quote_id
        JOIN leads l ON l.id = q.lead_id
        WHERE job.id = NEW.job_id AND l.customer_id = NEW.customer_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'Customer sign-off must belong to the installation customer');
      END;

      CREATE TRIGGER IF NOT EXISTS warranty_requires_completed_delivery
      BEFORE INSERT ON warranty_records
      WHEN NOT EXISTS (
        SELECT 1
        FROM dispatch_serials ds
        JOIN product_serials ps ON ps.id = ds.product_serial_id
        JOIN inventory_items item ON item.id = ps.inventory_item_id
        JOIN warranty_rules rule ON rule.product_type = item.product_type
        WHERE ds.product_serial_id = NEW.product_serial_id
          AND ds.delivery_completed_at IS NOT NULL
          AND date(ds.delivery_completed_at) = NEW.starts_on
          AND item.product_type = NEW.product_type
          AND rule.duration_years IS NEW.duration_years
      )
      BEGIN
        SELECT RAISE(ABORT, 'Warranty can only start on completed delivery and must use its product rule');
      END;

      CREATE TRIGGER IF NOT EXISTS delivered_serial_creates_warranty
      AFTER UPDATE OF delivery_completed_at ON dispatch_serials
      WHEN NEW.delivery_completed_at IS NOT NULL AND OLD.delivery_completed_at IS NULL
      BEGIN
        INSERT OR IGNORE INTO warranty_records (
          id, product_serial_id, product_type, duration_years, starts_on, ends_on, status
        )
        SELECT 'warranty-' || NEW.product_serial_id,
               NEW.product_serial_id,
               item.product_type,
               rule.duration_years,
               date(NEW.delivery_completed_at),
               CASE WHEN rule.duration_years IS NULL THEN NULL
                 ELSE date(NEW.delivery_completed_at, printf('+%g years', rule.duration_years))
               END,
               CASE WHEN rule.duration_years IS NULL THEN 'UNSPECIFIED' ELSE 'ACTIVE' END
        FROM product_serials ps
        JOIN inventory_items item ON item.id = ps.inventory_item_id
        JOIN warranty_rules rule ON rule.product_type = item.product_type
        WHERE ps.id = NEW.product_serial_id;
      END;

      CREATE TRIGGER IF NOT EXISTS service_ticket_item_customer_matches
      BEFORE INSERT ON service_ticket_items
      WHEN NOT EXISTS (
        SELECT 1
        FROM service_tickets ticket
        JOIN dispatch_serials ds ON ds.product_serial_id = NEW.product_serial_id
        JOIN dispatches d ON d.id = ds.dispatch_id
        JOIN orders o ON o.id = d.order_id
        JOIN quotations q ON q.id = o.quote_id
        JOIN leads l ON l.id = q.lead_id
        WHERE ticket.id = NEW.ticket_id
          AND ticket.customer_id = l.customer_id
          AND ds.delivery_completed_at IS NOT NULL
      )
      BEGIN
        SELECT RAISE(ABORT, 'Service ticket serial must belong to its customer');
      END;

      CREATE TRIGGER IF NOT EXISTS service_confirmation_customer_matches
      BEFORE INSERT ON customer_service_confirmations
      WHEN NOT EXISTS (
        SELECT 1 FROM service_tickets
        WHERE id = NEW.ticket_id AND customer_id = NEW.customer_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'Service confirmation must belong to the ticket customer');
      END;

      CREATE TRIGGER IF NOT EXISTS service_confirmation_customer_matches_update
      BEFORE UPDATE OF ticket_id, customer_id ON customer_service_confirmations
      WHEN NOT EXISTS (
        SELECT 1 FROM service_tickets
        WHERE id = NEW.ticket_id AND customer_id = NEW.customer_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'Service confirmation must belong to the ticket customer');
      END;

      CREATE TRIGGER IF NOT EXISTS service_ticket_order_customer_matches
      BEFORE INSERT ON service_tickets
      WHEN NEW.order_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM orders o
          JOIN quotations q ON q.id = o.quote_id
          JOIN leads l ON l.id = q.lead_id
          WHERE o.id = NEW.order_id AND l.customer_id = NEW.customer_id
        )
      BEGIN
        SELECT RAISE(ABORT, 'Service ticket order must belong to the ticket customer');
      END;

      CREATE TRIGGER IF NOT EXISTS service_ticket_close_requires_confirmation
      BEFORE UPDATE OF status ON service_tickets
      WHEN NEW.status = 'CLOSED'
        AND NOT EXISTS (
          SELECT 1 FROM customer_service_confirmations
          WHERE ticket_id = NEW.id AND customer_id = NEW.customer_id AND confirmed = 1
        )
      BEGIN
        SELECT RAISE(ABORT, 'Customer confirmation is required before final service closure');
      END;

      CREATE TRIGGER IF NOT EXISTS service_ticket_insert_requires_confirmation
      BEFORE INSERT ON service_tickets
      WHEN NEW.status = 'CLOSED'
        AND NOT EXISTS (
          SELECT 1 FROM customer_service_confirmations
          WHERE ticket_id = NEW.id AND customer_id = NEW.customer_id AND confirmed = 1
        )
      BEGIN
        SELECT RAISE(ABORT, 'Customer confirmation is required before final service closure');
      END;
    `)

    const insertWarrantyRule = database.prepare(`
      INSERT OR IGNORE INTO warranty_rules (
        product_type, duration_years, duration_specified, rule_note
      ) VALUES (?, ?, ?, ?)
    `)
    for (const rule of WARRANTY_RULES) insertWarrantyRule.run(...rule)

    database.exec(`
      CREATE VIEW IF NOT EXISTS v_customer_equipment_serials AS
      SELECT customer.id AS customer_id,
             customer.full_name AS customer_name,
             lead.id AS lead_id,
             orders.id AS order_id,
             dispatch.id AS dispatch_id,
             item.id AS inventory_item_id,
             item.name AS product_name,
             item.product_type,
             serial.serial_number,
             serial.warehouse_id,
             dispatch_serials.delivery_completed_at,
             warranty.duration_years,
             warranty.starts_on AS warranty_starts_on,
             warranty.ends_on AS warranty_ends_on,
             warranty.status AS warranty_status
      FROM product_serials serial
      JOIN inventory_items item ON item.id = serial.inventory_item_id
      JOIN dispatch_serials ON dispatch_serials.product_serial_id = serial.id
      JOIN dispatches dispatch ON dispatch.id = dispatch_serials.dispatch_id
      JOIN orders ON orders.id = dispatch.order_id
      JOIN quotations quote ON quote.id = orders.quote_id
      JOIN leads lead ON lead.id = quote.lead_id
      JOIN customers customer ON customer.id = lead.customer_id
      LEFT JOIN warranty_records warranty ON warranty.product_serial_id = serial.id;

      CREATE VIEW IF NOT EXISTS v_quotation_totals AS
      SELECT quotation.id AS quotation_id,
             COUNT(item.id) AS item_count,
             CASE WHEN COUNT(item.id) > 0 AND COUNT(item.unit_price) = COUNT(item.id)
               THEN SUM(item.quantity * item.unit_price)
               ELSE NULL
             END AS total_amount
      FROM quotations quotation
      LEFT JOIN quotation_items item ON item.quotation_id = quotation.id
      GROUP BY quotation.id;

      CREATE VIEW IF NOT EXISTS v_project_profitability AS
      WITH invoice_totals AS (
        SELECT invoice.order_id, SUM(item.quantity * item.unit_price) AS amount
        FROM invoices invoice
        JOIN invoice_items item ON item.invoice_id = invoice.id
        WHERE invoice.status IN ('ISSUED', 'PART_PAID', 'PAID')
        GROUP BY invoice.order_id
      ),
      quote_totals AS (
        SELECT quote.id AS quote_id,
               CASE WHEN COUNT(item.id) > 0 AND COUNT(item.unit_price) = COUNT(item.id)
                 THEN SUM(item.quantity * item.unit_price)
                 ELSE NULL
               END AS amount
        FROM quotations quote
        LEFT JOIN quotation_items item ON item.quotation_id = quote.id
        GROUP BY quote.id
      ),
      expense_totals AS (
        SELECT order_id, SUM(amount) AS amount FROM expenses
        WHERE order_id IS NOT NULL GROUP BY order_id
      ),
      purchase_totals AS (
        SELECT purchase.order_id, SUM(item.quantity * item.unit_cost) AS amount
        FROM stock_purchases purchase
        JOIN stock_purchase_items item ON item.purchase_id = purchase.id
        WHERE purchase.order_id IS NOT NULL AND purchase.status <> 'CANCELLED'
          AND item.unit_cost IS NOT NULL
        GROUP BY purchase.order_id
      ),
      payroll_totals AS (
        SELECT job.order_id,
               SUM(COALESCE(payroll.amount, payroll.hours * COALESCE(payroll.hourly_rate, 0))) AS amount
        FROM technician_payroll_entries payroll
        JOIN installation_jobs job ON job.id = payroll.job_id
        GROUP BY job.order_id
      )
      SELECT orders.id AS order_id,
             orders.order_number,
             customer.id AS customer_id,
             customer.full_name AS customer_name,
             orders.status AS order_status,
             EXISTS (
               SELECT 1 FROM demo_seed_records demo
               WHERE demo.entity_type = 'orders' AND demo.entity_id = orders.id
             ) AS is_demo,
             COALESCE(invoice_totals.amount, quote_totals.amount) AS revenue_amount,
             COALESCE(expense_totals.amount, 0)
               + COALESCE(purchase_totals.amount, 0)
               + COALESCE(payroll_totals.amount, 0) AS project_cost_amount,
             CASE WHEN COALESCE(invoice_totals.amount, quote_totals.amount) IS NULL THEN NULL
               ELSE COALESCE(invoice_totals.amount, quote_totals.amount)
                 - COALESCE(expense_totals.amount, 0)
                 - COALESCE(purchase_totals.amount, 0)
                 - COALESCE(payroll_totals.amount, 0)
             END AS project_profit_amount
      FROM orders
      JOIN quotations quote ON quote.id = orders.quote_id
      JOIN leads lead ON lead.id = quote.lead_id
      JOIN customers customer ON customer.id = lead.customer_id
      LEFT JOIN invoice_totals ON invoice_totals.order_id = orders.id
      LEFT JOIN quote_totals ON quote_totals.quote_id = quote.id
      LEFT JOIN expense_totals ON expense_totals.order_id = orders.id
      LEFT JOIN purchase_totals ON purchase_totals.order_id = orders.id
      LEFT JOIN payroll_totals ON payroll_totals.order_id = orders.id;

      CREATE VIEW IF NOT EXISTS v_lead_workflow_summary AS
      SELECT lead.id AS lead_id,
             lead.lead_number,
             lead.status AS lead_status,
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
