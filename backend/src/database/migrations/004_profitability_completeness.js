export const profitabilityCompletenessMigration = {
  version: 4,
  name: 'profitability_cost_completeness',

  up(database) {
    database.exec(`
      DROP VIEW IF EXISTS v_project_profitability;

      CREATE VIEW v_project_profitability AS
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
        SELECT order_id, SUM(amount) AS amount
        FROM expenses
        WHERE order_id IS NOT NULL
        GROUP BY order_id
      ),
      purchase_totals AS (
        SELECT purchase.order_id,
               SUM(CASE WHEN item.unit_cost IS NOT NULL
                 THEN item.quantity * item.unit_cost END) AS amount,
               SUM(CASE WHEN item.unit_cost IS NULL THEN 1 ELSE 0 END) AS unpriced_item_count
        FROM stock_purchases purchase
        JOIN stock_purchase_items item ON item.purchase_id = purchase.id
        WHERE purchase.order_id IS NOT NULL AND purchase.status <> 'CANCELLED'
        GROUP BY purchase.order_id
      ),
      payroll_totals AS (
        SELECT job.order_id,
               SUM(CASE
                 WHEN payroll.amount IS NOT NULL THEN payroll.amount
                 WHEN payroll.hourly_rate IS NOT NULL THEN payroll.hours * payroll.hourly_rate
               END) AS amount,
               SUM(CASE
                 WHEN payroll.amount IS NULL AND payroll.hourly_rate IS NULL THEN 1
                 ELSE 0
               END) AS unpriced_entry_count
        FROM technician_payroll_entries payroll
        JOIN installation_jobs job ON job.id = payroll.job_id
        GROUP BY job.order_id
      ),
      project_amounts AS (
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
                 + COALESCE(payroll_totals.amount, 0) AS known_project_cost_amount,
               COALESCE(purchase_totals.unpriced_item_count, 0)
                 + COALESCE(payroll_totals.unpriced_entry_count, 0) AS unpriced_cost_count
        FROM orders
        JOIN quotations quote ON quote.id = orders.quote_id
        JOIN leads lead ON lead.id = quote.lead_id
        JOIN customers customer ON customer.id = lead.customer_id
        LEFT JOIN invoice_totals ON invoice_totals.order_id = orders.id
        LEFT JOIN quote_totals ON quote_totals.quote_id = quote.id
        LEFT JOIN expense_totals ON expense_totals.order_id = orders.id
        LEFT JOIN purchase_totals ON purchase_totals.order_id = orders.id
        LEFT JOIN payroll_totals ON payroll_totals.order_id = orders.id
      )
      SELECT order_id,
             order_number,
             customer_id,
             customer_name,
             order_status,
             is_demo,
             revenue_amount,
             CASE WHEN unpriced_cost_count = 0 THEN known_project_cost_amount END
               AS project_cost_amount,
             CASE WHEN unpriced_cost_count = 0 THEN 1 ELSE 0 END AS costs_complete,
             CASE WHEN revenue_amount IS NOT NULL AND unpriced_cost_count = 0
               THEN revenue_amount - known_project_cost_amount
             END AS project_profit_amount
      FROM project_amounts;
    `)

    database.prepare(`
      UPDATE technician_payroll_entries
      SET hourly_rate = NULL,
          amount = NULL,
          paid_at = NULL,
          notes = 'SYNTHETIC recorded hours; compensation rate unspecified.'
      WHERE id IN (
        SELECT entity_id
        FROM demo_seed_records
        WHERE batch_id = 'sunpower-business-demo-v1'
          AND entity_type = 'technician_payroll_entries'
      )
    `).run()
  },
}
