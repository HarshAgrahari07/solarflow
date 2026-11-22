import { asyncHandler } from '../middleware/asyncHandler.js'
import {
  assignServiceTicket,
  completeChecklistItem,
  completeInstallation,
  confirmOrder,
  confirmServiceResolution,
  createExpense,
  createInvoice,
  createOrder,
  createPayroll,
  createServiceTicket,
  createStockPurchase,
  customerSignoff,
  getCustomerBusinessRecords,
  getFinanceReport,
  getInstallation,
  getOrder,
  getStockPurchase,
  listDispatches,
  listInstallations,
  listInvoices,
  listInventory,
  listOrders,
  listPayments,
  listPayroll,
  listPayrollOptions,
  listServiceTickets,
  listStockPurchases,
  listTechnicians,
  lookupSerial,
  receiveStock,
  receiveStockPurchase,
  recordGenerationTest,
  recordInstallationTime,
  recordPayment,
  resolveServiceTicket,
  scanDispatchSerial,
  scheduleInstallation,
  setDispatchWarehouse,
  startInstallation,
  updateDispatchStatus,
  updateInvoiceStatus,
} from '../services/workflowService.js'
import { financeReportQuerySchema } from '../validation/workflowSchemas.js'

export function createWorkflowController({ database }) {
  return {
    listOrders: asyncHandler((request, response) => {
      response.json({ orders: listOrders(database, request.user) })
    }),

    getOrder: asyncHandler((request, response) => {
      response.json({ order: getOrder(database, request.params.orderId, request.user) })
    }),

    createOrder: asyncHandler((request, response) => {
      response.status(201).json({ order: createOrder(database, request.validatedBody, request.user) })
    }),

    confirmOrder: asyncHandler((request, response) => {
      response.json({ order: confirmOrder(database, request.params.orderId, request.user) })
    }),

    listPayments: asyncHandler((request, response) => {
      response.json({ payments: listPayments(database, request.params.orderId, request.user) })
    }),

    recordPayment: asyncHandler((request, response) => {
      response.status(201).json({
        payment: recordPayment(database, request.params.orderId, request.validatedBody, request.user),
      })
    }),

    listInventory: asyncHandler((request, response) => {
      response.json({ inventory: listInventory(database) })
    }),

    receiveStock: asyncHandler((request, response) => {
      response.status(201).json({ receipt: receiveStock(database, request.validatedBody, request.user) })
    }),

    listDispatches: asyncHandler((request, response) => {
      response.json({ dispatches: listDispatches(database) })
    }),

    assignDispatchWarehouse: asyncHandler((request, response) => {
      response.json({
        dispatch: setDispatchWarehouse(
          database,
          request.params.dispatchId,
          request.validatedBody.warehouseId,
          request.user,
        ),
      })
    }),

    scanDispatchSerial: asyncHandler((request, response) => {
      response.status(201).json({
        serial: scanDispatchSerial(
          database,
          request.params.dispatchId,
          request.validatedBody.serialNumber,
          request.user,
        ),
      })
    }),

    updateDispatchStatus: asyncHandler((request, response) => {
      response.json({
        dispatch: updateDispatchStatus(
          database,
          request.params.dispatchId,
          request.validatedBody.status,
          request.user,
        ),
      })
    }),

    listInstallations: asyncHandler((request, response) => {
      response.json({ installations: listInstallations(database, request.user) })
    }),

    listTechnicians: asyncHandler((request, response) => {
      response.json({ technicians: listTechnicians(database, request.user) })
    }),

    getInstallation: asyncHandler((request, response) => {
      response.json({ installation: getInstallation(database, request.params.jobId, request.user) })
    }),

    scheduleInstallation: asyncHandler((request, response) => {
      response.json({
        installation: scheduleInstallation(
          database,
          request.params.jobId,
          request.validatedBody,
          request.user,
        ),
      })
    }),

    startInstallation: asyncHandler((request, response) => {
      response.json({ installation: startInstallation(database, request.params.jobId, request.user) })
    }),

    updateChecklist: asyncHandler((request, response) => {
      response.json({
        installation: completeChecklistItem(
          database,
          request.params.jobId,
          request.params.checkCode,
          request.validatedBody,
          request.user,
        ),
      })
    }),

    recordTime: asyncHandler((request, response) => {
      response.status(201).json({
        timeLog: recordInstallationTime(
          database,
          request.params.jobId,
          request.validatedBody,
          request.user,
        ),
      })
    }),

    recordGenerationTest: asyncHandler((request, response) => {
      response.json({
        installation: recordGenerationTest(
          database,
          request.params.jobId,
          request.validatedBody.result,
          request.user,
        ),
      })
    }),

    signoffInstallation: asyncHandler((request, response) => {
      response.status(201).json({
        installation: customerSignoff(
          database,
          request.params.jobId,
          request.validatedBody,
          request.user,
        ),
      })
    }),

    completeInstallation: asyncHandler((request, response) => {
      response.json({ installation: completeInstallation(database, request.params.jobId, request.user) })
    }),

    listServiceTickets: asyncHandler((request, response) => {
      response.json({ tickets: listServiceTickets(database, request.user) })
    }),

    createServiceTicket: asyncHandler((request, response) => {
      response.status(201).json({
        ticket: createServiceTicket(database, request.validatedBody, request.user),
      })
    }),

    assignServiceTicket: asyncHandler((request, response) => {
      response.json({
        ticket: assignServiceTicket(
          database,
          request.params.ticketId,
          request.validatedBody.supportUserId,
          request.user,
        ),
      })
    }),

    resolveServiceTicket: asyncHandler((request, response) => {
      response.json({
        ticket: resolveServiceTicket(
          database,
          request.params.ticketId,
          request.validatedBody,
          request.user,
        ),
      })
    }),

    confirmServiceResolution: asyncHandler((request, response) => {
      response.json({
        ticket: confirmServiceResolution(
          database,
          request.params.ticketId,
          request.validatedBody,
          request.user,
        ),
      })
    }),

    lookupSerial: asyncHandler((request, response) => {
      response.json({ equipment: lookupSerial(database, request.params.serialNumber, request.user) })
    }),

    createExpense: asyncHandler((request, response) => {
      response.status(201).json({ expense: createExpense(database, request.validatedBody, request.user) })
    }),

    payrollOptions: asyncHandler((request, response) => {
      response.json({ options: listPayrollOptions(database, request.user) })
    }),

    listPayroll: asyncHandler((request, response) => {
      response.json({ payroll: listPayroll(database, request.user) })
    }),

    createPayroll: asyncHandler((request, response) => {
      response.status(201).json({ payroll: createPayroll(database, request.validatedBody, request.user) })
    }),

    financeReport: asyncHandler((request, response, next) => {
      const parsed = financeReportQuerySchema.safeParse(request.query)
      if (!parsed.success) return next(parsed.error)
      response.json({ report: getFinanceReport(database, parsed.data, request.user) })
    }),

    listInvoices: asyncHandler((request, response) => {
      response.json({ invoices: listInvoices(database, request.user) })
    }),

    createInvoice: asyncHandler((request, response) => {
      response.status(201).json({ invoice: createInvoice(database, request.validatedBody, request.user) })
    }),

    updateInvoiceStatus: asyncHandler((request, response) => {
      response.json({
        invoice: updateInvoiceStatus(
          database,
          request.params.invoiceId,
          request.validatedBody.status,
          request.user,
        ),
      })
    }),

    listStockPurchases: asyncHandler((request, response) => {
      response.json({ purchases: listStockPurchases(database, request.user) })
    }),

    getStockPurchase: asyncHandler((request, response) => {
      response.json({ purchase: getStockPurchase(database, request.params.purchaseId, request.user) })
    }),

    createStockPurchase: asyncHandler((request, response) => {
      response.status(201).json({
        purchase: createStockPurchase(database, request.validatedBody, request.user),
      })
    }),

    receiveStockPurchase: asyncHandler((request, response) => {
      response.json({
        purchase: receiveStockPurchase(
          database,
          request.params.purchaseId,
          request.validatedBody,
          request.user,
        ),
      })
    }),

    customerRecords: asyncHandler((request, response) => {
      response.json({ records: getCustomerBusinessRecords(database, request.user) })
    }),
  }
}
