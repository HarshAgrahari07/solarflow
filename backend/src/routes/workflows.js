import { Router } from 'express'
import { createWorkflowController } from '../controllers/workflowController.js'
import { authenticate, authorizeRoles } from '../middleware/authenticate.js'
import { validateBody } from '../middleware/validateBody.js'
import {
  checklistUpdateSchema,
  customerSignoffSchema,
  dispatchSerialSchema,
  dispatchStatusSchema,
  dispatchWarehouseSchema,
  expenseCreateSchema,
  generationTestSchema,
  installationScheduleSchema,
  invoiceCreateSchema,
  invoiceStatusSchema,
  orderCreateSchema,
  paymentCreateSchema,
  payrollCreateSchema,
  serviceAssignSchema,
  serviceConfirmationSchema,
  serviceResolutionSchema,
  serviceTicketCreateSchema,
  stockPurchaseCreateSchema,
  stockPurchaseReceiveSchema,
  stockReceiptSchema,
  timeLogSchema,
} from '../validation/workflowSchemas.js'

export function createWorkflowRouter({ database, config }) {
  const router = Router()
  const controller = createWorkflowController({ database })
  const requireUser = authenticate({ database, config })

  router.use(requireUser)

  router.get('/orders', authorizeRoles('ADMIN', 'SALES', 'CUSTOMER', 'FINANCE', 'WAREHOUSE', 'TECHNICIAN'), controller.listOrders)
  router.post('/orders', authorizeRoles('ADMIN', 'SALES'), validateBody(orderCreateSchema), controller.createOrder)
  router.get('/orders/:orderId', authorizeRoles('ADMIN', 'SALES', 'CUSTOMER', 'FINANCE', 'WAREHOUSE', 'TECHNICIAN'), controller.getOrder)
  router.post('/orders/:orderId/confirm', authorizeRoles('ADMIN'), controller.confirmOrder)
  router.get('/orders/:orderId/payments', authorizeRoles('ADMIN', 'FINANCE', 'CUSTOMER'), controller.listPayments)
  router.post('/orders/:orderId/payments', authorizeRoles('ADMIN', 'FINANCE'), validateBody(paymentCreateSchema), controller.recordPayment)

  router.get('/inventory', authorizeRoles('ADMIN', 'WAREHOUSE', 'FINANCE'), controller.listInventory)
  router.post('/inventory/receipts', authorizeRoles('ADMIN', 'WAREHOUSE'), validateBody(stockReceiptSchema), controller.receiveStock)
  router.get('/dispatches', authorizeRoles('ADMIN', 'WAREHOUSE'), controller.listDispatches)
  router.patch('/dispatches/:dispatchId/warehouse', authorizeRoles('ADMIN', 'WAREHOUSE'), validateBody(dispatchWarehouseSchema), controller.assignDispatchWarehouse)
  router.post('/dispatches/:dispatchId/serials', authorizeRoles('ADMIN', 'WAREHOUSE'), validateBody(dispatchSerialSchema), controller.scanDispatchSerial)
  router.patch('/dispatches/:dispatchId/status', authorizeRoles('ADMIN', 'WAREHOUSE'), validateBody(dispatchStatusSchema), controller.updateDispatchStatus)

  router.get('/installations', authorizeRoles('ADMIN', 'TECHNICIAN', 'CUSTOMER'), controller.listInstallations)
  router.get('/technicians', authorizeRoles('ADMIN'), controller.listTechnicians)
  router.get('/installations/:jobId', authorizeRoles('ADMIN', 'TECHNICIAN', 'CUSTOMER'), controller.getInstallation)
  router.patch('/installations/:jobId/schedule', authorizeRoles('ADMIN'), validateBody(installationScheduleSchema), controller.scheduleInstallation)
  router.post('/installations/:jobId/start', authorizeRoles('ADMIN', 'TECHNICIAN'), controller.startInstallation)
  router.patch('/installations/:jobId/checklist/:checkCode', authorizeRoles('ADMIN', 'TECHNICIAN'), validateBody(checklistUpdateSchema), controller.updateChecklist)
  router.post('/installations/:jobId/time-logs', authorizeRoles('ADMIN', 'TECHNICIAN'), validateBody(timeLogSchema), controller.recordTime)
  router.put('/installations/:jobId/commissioning', authorizeRoles('ADMIN', 'TECHNICIAN'), validateBody(generationTestSchema), controller.recordGenerationTest)
  router.post('/installations/:jobId/signoff', authorizeRoles('CUSTOMER'), validateBody(customerSignoffSchema), controller.signoffInstallation)
  router.post('/installations/:jobId/complete', authorizeRoles('ADMIN', 'TECHNICIAN'), controller.completeInstallation)

  router.get('/service-tickets', authorizeRoles('ADMIN', 'SUPPORT', 'CUSTOMER'), controller.listServiceTickets)
  router.post('/service-tickets', authorizeRoles('ADMIN', 'SUPPORT', 'CUSTOMER'), validateBody(serviceTicketCreateSchema), controller.createServiceTicket)
  router.patch('/service-tickets/:ticketId/assignment', authorizeRoles('ADMIN', 'SUPPORT'), validateBody(serviceAssignSchema), controller.assignServiceTicket)
  router.post('/service-tickets/:ticketId/resolve', authorizeRoles('ADMIN', 'SUPPORT'), validateBody(serviceResolutionSchema), controller.resolveServiceTicket)
  router.post('/service-tickets/:ticketId/confirm', authorizeRoles('CUSTOMER'), validateBody(serviceConfirmationSchema), controller.confirmServiceResolution)
  router.get('/serials/:serialNumber', authorizeRoles('ADMIN', 'SUPPORT', 'CUSTOMER'), controller.lookupSerial)

  router.get('/finance/report', authorizeRoles('ADMIN', 'FINANCE'), controller.financeReport)
  router.post('/finance/expenses', authorizeRoles('ADMIN', 'FINANCE'), validateBody(expenseCreateSchema), controller.createExpense)
  router.get('/finance/payroll/options', authorizeRoles('ADMIN', 'FINANCE'), controller.payrollOptions)
  router.get('/finance/payroll', authorizeRoles('ADMIN', 'FINANCE'), controller.listPayroll)
  router.post('/finance/payroll', authorizeRoles('ADMIN', 'FINANCE'), validateBody(payrollCreateSchema), controller.createPayroll)
  router.get('/finance/invoices', authorizeRoles('ADMIN', 'FINANCE'), controller.listInvoices)
  router.post('/finance/invoices', authorizeRoles('ADMIN', 'FINANCE'), validateBody(invoiceCreateSchema), controller.createInvoice)
  router.patch('/finance/invoices/:invoiceId/status', authorizeRoles('ADMIN', 'FINANCE'), validateBody(invoiceStatusSchema), controller.updateInvoiceStatus)
  router.get('/finance/purchases', authorizeRoles('ADMIN', 'FINANCE', 'WAREHOUSE'), controller.listStockPurchases)
  router.post('/finance/purchases', authorizeRoles('ADMIN', 'FINANCE'), validateBody(stockPurchaseCreateSchema), controller.createStockPurchase)
  router.get('/finance/purchases/:purchaseId', authorizeRoles('ADMIN', 'FINANCE', 'WAREHOUSE'), controller.getStockPurchase)
  router.post('/finance/purchases/:purchaseId/receive', authorizeRoles('ADMIN', 'WAREHOUSE'), validateBody(stockPurchaseReceiveSchema), controller.receiveStockPurchase)

  router.get('/customer-records', authorizeRoles('CUSTOMER'), controller.customerRecords)

  return router
}
