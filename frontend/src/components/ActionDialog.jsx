import { useEffect, useId, useState } from 'react'
import { TECHNICIANS } from '../data/demoData'
import Icon from './Icon'

const FORMS = {
  quotation: {
    title: 'Create quotation',
    lead: 'Draft a quotation (1.0 kW to 5.0 kW). Requires an approved associated roof survey.',
    submit: 'Create quotation',
    fields: [
      { name: 'customer', label: 'Customer', placeholder: 'e.g. Meera Kapoor (Home)' },
      {
        name: 'surveyRef',
        label: 'Associated roof survey (Must have Approved status)',
        type: 'select',
        options: [
          'SRV-101 (Meera Kapoor - Approved)',
          'SRV-102 (Rajesh Gupta - Approved)',
          'SRV-103 (Apex Auto Components - Approved)',
          'SRV-104 (Anil Verma - Approved)',
          'SRV-105 (Sneha Iyer - Approved)',
          'SRV-106 (Vikram Sethi - Approved)',
        ],
      },
      {
        name: 'packageType',
        label: 'Solar package type',
        type: 'select',
        options: ['On-Grid System (1 kW to 5 kW)', 'Off-Grid System (1 kW to 5 kW)'],
      },
      {
        name: 'capacity',
        label: 'System capacity (1.0 kW to 5.0 kW inclusive)',
        type: 'number',
        min: '1.0',
        max: '5.0',
        step: 'any',
        placeholder: 'Between 1.0 and 5.0 kW (e.g. 3.6)',
      },
      {
        name: 'amount',
        label: 'Illustrative quoted amount in INR (Demo estimate)',
        type: 'number',
        min: '1000',
        step: '1000',
        placeholder: 'e.g. 185000',
      },
    ],
  },
  installation: {
    title: 'Schedule installation',
    lead: 'Assign a 1.0 kW to 5.0 kW installation to our 15-technician crew.',
    submit: 'Schedule installation',
    fields: [
      { name: 'customer', label: 'Customer name', placeholder: 'e.g. Harjit Sandhu (Home)' },
      {
        name: 'packageType',
        label: 'Solar package type',
        type: 'select',
        options: ['On-Grid System', 'Off-Grid System'],
      },
      { name: 'location', label: 'Location', placeholder: 'e.g. Mohali' },
      {
        name: 'capacity',
        label: 'System capacity (1.0 kW to 5.0 kW inclusive)',
        type: 'number',
        min: '1.0',
        max: '5.0',
        step: 'any',
        placeholder: 'Between 1.0 and 5.0 kW (e.g. 4.0)',
      },
      { name: 'date', label: 'Installation date', type: 'date' },
      {
        name: 'technician',
        label: 'Assigned crew member (1 of 15 demo technicians)',
        type: 'select',
        options: TECHNICIANS,
      },
    ],
  },
  inventory: {
    title: 'Add inventory',
    lead: 'Record components and stock in demonstration warehouse.',
    submit: 'Add inventory',
    fields: [
      { name: 'item', label: 'Item name', placeholder: 'e.g. 5 kW Inverter' },
      { name: 'sku', label: 'SKU', placeholder: 'e.g. INV-ONGRID-5K' },
      { name: 'quantity', label: 'Quantity', type: 'number', min: '1', step: '1' },
      { name: 'warehouse', label: 'Warehouse', placeholder: 'e.g. Ludhiana' },
      {
        name: 'serialTracking',
        label: 'Component type & serial requirement',
        type: 'select',
        options: [
          'Required component · Serial required (Inverter/Battery/Charge controller)',
          'Required component · Batch tracked (Solar panels)',
          'Required component · Standard kit item (Wiring boxes/Earthing/Stands/Wires)',
        ],
      },
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

    if (data.capacity !== undefined && data.capacity !== '') {
      const cap = Number(data.capacity)
      if (Number.isNaN(cap) || cap < 1.0 || cap > 5.0) {
        setError('System capacity must be strictly between 1.0 kW and 5.0 kW inclusive.')
        return
      }
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
                      Select an option
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
                    max={field.max}
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
