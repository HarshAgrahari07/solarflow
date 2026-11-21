import { useEffect, useId, useState } from 'react'
import { TECHNICIANS } from '../data/demoData'
import Icon from './Icon'

const FORMS = {
  customer: {
    title: 'Add customer',
    lead: 'Save a lead into the demonstration workspace.',
    submit: 'Save customer',
    fields: [
      { name: 'name', label: 'Customer name', placeholder: 'e.g. Meera Kapoor' },
      { name: 'city', label: 'City', placeholder: 'e.g. Ludhiana' },
      { name: 'phone', label: 'Phone', placeholder: 'e.g. 98150 22014' },
    ],
  },
  quotation: {
    title: 'Create quotation',
    lead: 'Draft a system size and price for review.',
    submit: 'Create quotation',
    fields: [
      { name: 'customer', label: 'Customer', placeholder: 'Customer or company' },
      { name: 'capacity', label: 'System capacity (kW)', type: 'number', min: '0.1', step: '0.1' },
      { name: 'amount', label: 'Quoted amount (INR)', type: 'number', min: '1', step: '1' },
    ],
  },
  installation: {
    title: 'Schedule installation',
    lead: 'The new job appears in the installations table immediately.',
    submit: 'Schedule installation',
    fields: [
      { name: 'customer', label: 'Customer name', placeholder: 'Customer or company' },
      { name: 'location', label: 'Location', placeholder: 'e.g. Mohali' },
      { name: 'capacity', label: 'System capacity (kW)', type: 'number', min: '0.1', step: '0.1' },
      { name: 'date', label: 'Installation date', type: 'date' },
      { name: 'technician', label: 'Assigned technician', type: 'select', options: TECHNICIANS },
    ],
  },
  inventory: {
    title: 'Add inventory',
    lead: 'Record stock in the demonstration warehouse list.',
    submit: 'Add inventory',
    fields: [
      { name: 'item', label: 'Item name', placeholder: 'e.g. 540 W mono panel' },
      { name: 'sku', label: 'SKU', placeholder: 'e.g. PAN-540' },
      { name: 'quantity', label: 'Quantity', type: 'number', min: '1', step: '1' },
      { name: 'warehouse', label: 'Warehouse', placeholder: 'e.g. Ludhiana' },
    ],
  },
}

export default function ActionDialog({ type, onClose, onSubmit }) {
  const form = FORMS[type]
  const titleId = useId()
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!form) return null

  function handleSubmit(event) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const missing = form.fields.some((field) => !String(data[field.name] || '').trim())
    const invalidNumber = form.fields.some((field) => {
      if (field.type !== 'number') return false
      return !(Number(data[field.name]) > 0)
    })

    if (missing || invalidNumber) {
      setError('Complete every field with a valid value before saving.')
      return
    }

    onSubmit(type, data)
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <div>
            <h2 id={titleId}>{form.title}</h2>
            <p>{form.lead}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {form.fields.map((field) => (
              <label key={field.name} className="field">
                <span>{field.label}</span>
                {field.type === 'select' ? (
                  <select name={field.name} defaultValue="">
                    <option value="" disabled>
                      Select a technician
                    </option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={field.name}
                    type={field.type || 'text'}
                    min={field.min}
                    step={field.step}
                    placeholder={field.placeholder}
                  />
                )}
              </label>
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {form.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
