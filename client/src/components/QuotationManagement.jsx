import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'

function errorText(error) {
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

export default function QuotationManagement({ query = '', user }) {
  const { request } = useAuth()
  const [options, setOptions] = useState({ surveys: [], packageTemplates: [] })
  const [quotations, setQuotations] = useState([])
  const [orders, setOrders] = useState([])
  const [surveyId, setSurveyId] = useState('')
  const [packageTemplateId, setPackageTemplateId] = useState('')
  const [componentValues, setComponentValues] = useState({})
  const [quoteDetails, setQuoteDetails] = useState(null)
  const [detailItems, setDetailItems] = useState([])
  const [terms, setTerms] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const reload = useCallback(async () => {
    setError('')
    try {
      const [nextOptions, nextQuotes, nextOrders] = await Promise.all([
        request('/api/quotations/options'),
        request('/api/quotations'),
        request('/api/operations/orders'),
      ])
      setOptions(nextOptions)
      setQuotations(nextQuotes.quotations)
      setOrders(nextOrders.orders)
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => {
    let active = true
    async function loadInitialData() {
      try {
        const [nextOptions, nextQuotes, nextOrders] = await Promise.all([
          request('/api/quotations/options'),
          request('/api/quotations'),
          request('/api/operations/orders'),
        ])
        if (!active) return
        setOptions(nextOptions)
        setQuotations(nextQuotes.quotations)
        setOrders(nextOrders.orders)
      } catch (requestError) {
        if (active) setError(errorText(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadInitialData()
    return () => { active = false }
  }, [request])

  const activeSurveyId = surveyId || options.surveys[0]?.id || ''
  const selectedSurvey = options.surveys.find((survey) => survey.id === activeSurveyId)
  const selectedTemplate = options.packageTemplates.find((item) => item.id === packageTemplateId)
  const availableTemplates = selectedSurvey
    ? options.packageTemplates.filter((item) => (
      ['SOLAR_PANEL_SET', 'INSTALLATION_SERVICE'].includes(item.systemType)
      || item.systemType === (selectedSurvey.systemType === 'Off-Grid System' ? 'OFF_GRID' : 'ON_GRID')
    ))
    : options.packageTemplates
  const visibleQuotes = quotations.filter((quotation) => (
    `${quotation.quoteNumber} ${quotation.customerName} ${quotation.surveyReference} ${quotation.status}`
      .toLowerCase().includes(query.trim().toLowerCase())
  ))

  async function createQuotation(event) {
    event.preventDefault()
    if (!selectedSurvey) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await request('/api/quotations', {
        method: 'POST',
        body: {
          surveyId: activeSurveyId,
          ...(packageTemplateId ? { packageTemplateId } : {}),
          ...(selectedTemplate ? {
            items: selectedTemplate.items.map((item) => {
              const values = componentValues[item.id] || {}
              return {
                templateItemId: item.id,
                description: item.description,
                quantity: Number(values.quantity ?? item.quantity),
                unit: values.unit || item.unit,
                unitPrice: values.unitPrice === '' || values.unitPrice === undefined
                  ? item.unitPrice
                  : Number(values.unitPrice),
              }
            }),
          } : {}),
          terms,
        },
      })
      setNotice(`${response.quotation.quoteNumber} saved as a draft. No price has been invented.`)
      setTerms('')
      await reload()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function openQuote(quotation) {
    setError('')
    try {
      const response = await request(`/api/quotations/${encodeURIComponent(quotation.id)}`)
      setQuoteDetails(response.quotation)
      setDetailItems(response.quotation.items.map((item) => ({ ...item })))
    } catch (requestError) {
      setError(errorText(requestError))
    }
  }

  function changeDetailItem(index, field, value) {
    setDetailItems((current) => current.map((item, currentIndex) => (
      currentIndex === index
        ? { ...item, [field]: field === 'unitPrice' && value === '' ? null : value }
        : item
    )))
  }

  async function saveQuoteItems(event) {
    event.preventDefault()
    if (!quoteDetails) return
    setSaving(true)
    setError('')
    try {
      const response = await request(`/api/quotations/${encodeURIComponent(quoteDetails.id)}/items`, {
        method: 'PUT',
        body: {
          items: detailItems.map((item) => ({
            ...(item.templateItemId ? { templateItemId: item.templateItemId } : {}),
            description: item.description,
            quantity: Number(item.quantity),
            unit: item.unit,
            unitPrice: item.unitPrice === null || item.unitPrice === '' ? null : Number(item.unitPrice),
          })),
        },
      })
      setQuoteDetails(response.quotation)
      setDetailItems(response.quotation.items.map((item) => ({ ...item })))
      setNotice(`Quotation revision ${response.quotation.version} saved.`)
      await reload()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function releaseQuotation(quotation) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await request(`/api/quotations/${encodeURIComponent(quotation.id)}/status`, {
        method: 'PATCH',
        body: { status: 'RELEASED' },
      })
      setNotice(`${quotation.quoteNumber} released for customer delivery.`)
      await reload()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function createOrder(quotation) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await request('/api/operations/orders', {
        method: 'POST',
        body: { quoteId: quotation.id },
      })
      setNotice(`Order ${response.order.orderNumber} created. Payment and warehouse steps can now proceed.`)
      await reload()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard quotation-management">
      {error && <p className="form-error survey-message" role="alert">{error}</p>}
      {notice && <p className="form-success survey-message" role="status">{notice}</p>}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Create a quotation draft</h2>
            <p>Only surveys with recorded approval are selectable. Package templates are configurable and this form does not invent prices.</p>
          </div>
        </div>
        <form className="survey-form-grid" onSubmit={createQuotation}>
          <label className="field">
            <span>Approved survey</span>
            <select value={activeSurveyId} onChange={(event) => setSurveyId(event.target.value)} required>
              <option value="" disabled>Select approved survey</option>
              {options.surveys.map((survey) => (
                <option key={survey.id} value={survey.id}>
                  {survey.reference} · {survey.customerName} · {survey.capacityKw ?? 'Capacity not recorded'} kW
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Package template (optional)</span>
            <select
              value={packageTemplateId}
              onChange={(event) => {
                setPackageTemplateId(event.target.value)
                setComponentValues({})
              }}
            >
              <option value="">Select later / no template</option>
              {availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          {selectedTemplate?.items.map((item) => (
            <div className="quotation-component-fields" key={item.id}>
              <strong>{item.description}</strong>
              <label className="field">
                <span>Quantity ({item.unit})</span>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  required
                  value={componentValues[item.id]?.quantity ?? item.quantity ?? ''}
                  onChange={(event) => setComponentValues((current) => ({
                    ...current,
                    [item.id]: { ...current[item.id], quantity: event.target.value },
                  }))}
                />
              </label>
              <label className="field">
                <span>Unit price (optional; configured/demo rate)</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={componentValues[item.id]?.unitPrice ?? item.unitPrice ?? ''}
                  onChange={(event) => setComponentValues((current) => ({
                    ...current,
                    [item.id]: { ...current[item.id], unitPrice: event.target.value },
                  }))}
                />
              </label>
            </div>
          ))}
          <label className="field survey-address-field">
            <span>Terms and notes</span>
            <textarea value={terms} onChange={(event) => setTerms(event.target.value)} maxLength="5000" rows="3" />
          </label>
          {selectedSurvey && (
            <p className="survey-selection-summary">
              {selectedSurvey.customerName} · {selectedSurvey.systemType || 'System preference not recorded'} ·
              {' '}{selectedSurvey.capacityKw ?? 'Capacity not recorded'} kW
              {selectedTemplate ? ` · ${selectedTemplate.name}` : ''}
            </p>
          )}
          <div className="survey-form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving || !activeSurveyId}>
              {saving ? 'Saving…' : 'Save quotation draft'}
            </button>
            {!options.surveys.length && <span className="text-muted">No approved surveys are available in your assigned customer scope.</span>}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Quotation register</h2>
            <p>Release is revalidated by the backend and database before customer delivery.</p>
          </div>
          <span className="count-pill">{visibleQuotes.length} quotations</span>
        </div>
        {loading ? (
          <div className="survey-loading" role="status"><span className="loading-spinner" /> Loading quotations…</div>
        ) : visibleQuotes.length ? (
          <div className="table-wrap">
            <table className="data-table survey-table">
              <thead><tr><th>Quotation</th><th>Customer</th><th>Survey</th><th>Package</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {visibleQuotes.map((quotation) => (
                  <tr key={quotation.id}>
                    <td><strong>{quotation.quoteNumber}</strong></td>
                    <td>{quotation.customerName}</td>
                    <td>{quotation.surveyReference}</td>
                    <td>{quotation.packageName || 'Not selected'}</td>
                    <td><span className="status">{quotation.status}</span></td>
                    <td className="quotation-row-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openQuote(quotation)}>Details</button>
                      {['DRAFT', 'PENDING'].includes(quotation.status) && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => releaseQuotation(quotation)} disabled={saving}>
                          Release
                        </button>
                      )}
                      {quotation.status === 'ACCEPTED' && (
                        orders.some((order) => order.quoteId === quotation.id)
                          ? <span className="status status-completed">Order created</span>
                          : <button type="button" className="btn btn-primary btn-sm" onClick={() => createOrder(quotation)} disabled={saving}>Create order</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty" role="status">
            <h3>{query ? 'No matching quotations' : 'No quotations yet'}</h3>
            <p>{query ? 'Try another search.' : 'A draft will appear after it is created from an approved survey.'}</p>
          </div>
        )}
      </section>

      {user?.role === 'ADMIN' && (
        <PackageTemplateEditor templates={options.packageTemplates} request={request} onSaved={reload} />
      )}

      {quoteDetails && (
        <div className="dialog-backdrop" onClick={() => setQuoteDetails(null)}>
          <section className="dialog quotation-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-head">
              <div>
                <p className="role-kicker">Version {quoteDetails.version}</p>
                <h2 id="quote-detail-title">{quoteDetails.quoteNumber}</h2>
                <p>{quoteDetails.customerName} · {quoteDetails.surveyReference} · {quoteDetails.status}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setQuoteDetails(null)} aria-label="Close quotation details">×</button>
            </div>
            {quoteDetails.status === 'DRAFT' ? (
              <form onSubmit={saveQuoteItems}>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Component</th><th>Quantity</th><th>Unit</th><th>Unit price</th></tr></thead>
                    <tbody>{detailItems.map((item, index) => (
                      <tr key={item.id || item.templateItemId}>
                        <td>{item.description}</td>
                        <td><input aria-label={`${item.description} quantity`} type="number" min="0.001" step="any" value={item.quantity} onChange={(event) => changeDetailItem(index, 'quantity', Number(event.target.value))} required /></td>
                        <td><input aria-label={`${item.description} unit`} value={item.unit} onChange={(event) => changeDetailItem(index, 'unit', event.target.value)} required /></td>
                        <td><input aria-label={`${item.description} unit price`} type="number" min="0" step="any" value={item.unitPrice ?? ''} onChange={(event) => changeDetailItem(index, 'unitPrice', event.target.value)} /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <p className="text-muted">A blank price remains unspecified; it is not treated as an official zero price.</p>
                <div className="dialog-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setQuoteDetails(null)}>Close</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save new revision'}</button>
                </div>
              </form>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Component</th><th>Quantity</th><th>Unit price</th></tr></thead>
                  <tbody>{detailItems.map((item) => <tr key={item.id}><td>{item.description}</td><td>{item.quantity} {item.unit}</td><td>{item.unitPrice ?? 'Not priced'}</td></tr>)}</tbody>
                </table>
                <p>Revisions: {quoteDetails.revisions.map((revision) => revision.version).join(', ') || '1'}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function PackageTemplateEditor({ templates, request, onSaved }) {
  const [templateId, setTemplateId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function selectTemplate(id) {
    const template = templates.find((item) => item.id === id)
    setTemplateId(id)
    setName(template?.name || '')
    setDescription(template?.description || '')
    setItems(template?.items.map((item) => ({ ...item })) || [])
  }

  function changeItem(index, field, value) {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, [field]: value === '' ? null : field === 'componentCode' || field === 'description' || field === 'unit' ? value : Number(value) }
        : item
    )))
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await request(`/api/quotations/templates/${encodeURIComponent(templateId)}`, {
        method: 'PUT',
        body: {
          name,
          description,
          items: items.map((item) => ({
            componentCode: item.componentCode,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
          })),
        },
      })
      setSuccess('Package template saved.')
      await onSaved()
      selectTemplate(templateId)
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel package-template-editor">
      <div className="section-head"><div><h2>Configure package templates</h2><p>Admin-managed BOM components, site-configurable quantities, and optional illustrative unit rates.</p></div></div>
      <label className="field">
        <span>Template</span>
        <select value={templateId} onChange={(event) => selectTemplate(event.target.value)}>
          <option value="">Select a template</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </label>
      {templateId && (
        <form className="template-form" onSubmit={save}>
          <label className="field"><span>Template name</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength="120" /></label>
          <label className="field"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength="2000" /></label>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Component</th><th>Description</th><th>Qty (optional)</th><th>Unit</th><th>Unit price (optional)</th></tr></thead>
              <tbody>{items.map((item, index) => <tr key={item.id}>
                <td>{item.componentCode}</td>
                <td><input aria-label={`${item.componentCode} description`} value={item.description} onChange={(event) => changeItem(index, 'description', event.target.value)} required /></td>
                <td><input aria-label={`${item.componentCode} quantity`} type="number" min="0.001" step="any" value={item.quantity ?? ''} onChange={(event) => changeItem(index, 'quantity', event.target.value)} /></td>
                <td><input aria-label={`${item.componentCode} unit`} value={item.unit} onChange={(event) => changeItem(index, 'unit', event.target.value)} required /></td>
                <td><input aria-label={`${item.componentCode} illustrative unit price`} type="number" min="0" step="any" value={item.unitPrice ?? ''} onChange={(event) => changeItem(index, 'unitPrice', event.target.value)} /></td>
              </tr>)}</tbody>
            </table>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {success && <p className="form-success" role="status">{success}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save template'}</button>
        </form>
      )}
    </section>
  )
}
