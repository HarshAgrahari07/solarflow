export const stockReservationBalanceMigration = {
  version: 9,
  name: 'stock_reservation_balance',

  up(database) {
    database.exec(`
      DROP TRIGGER stock_movement_applies_balance;

      CREATE TRIGGER stock_movement_applies_balance
      AFTER INSERT ON stock_movements
      BEGIN
        INSERT INTO stock_balances (
          warehouse_id, inventory_item_id, quantity_on_hand, quantity_reserved, updated_at
        )
        VALUES (
          NEW.warehouse_id,
          NEW.inventory_item_id,
          CASE
            WHEN NEW.movement_type IN ('RECEIPT', 'ADJUSTMENT_IN') THEN NEW.quantity
            WHEN NEW.movement_type = 'RESERVE' THEN coalesce((
              SELECT quantity_on_hand FROM stock_balances
              WHERE warehouse_id = NEW.warehouse_id
                AND inventory_item_id = NEW.inventory_item_id
            ), 0)
            ELSE 0
          END,
          CASE
            WHEN NEW.movement_type = 'RESERVE' THEN NEW.quantity + coalesce((
              SELECT quantity_reserved FROM stock_balances
              WHERE warehouse_id = NEW.warehouse_id
                AND inventory_item_id = NEW.inventory_item_id
            ), 0)
            ELSE 0
          END,
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
    `)
  },
}
