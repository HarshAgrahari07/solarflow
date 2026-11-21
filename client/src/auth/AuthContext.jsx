import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './context'
import { apiRequest, fetchCurrentUser } from './api'

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadCurrentUser = useCallback(async () => {
    try {
      const currentUser = await fetchCurrentUser()
      setUser(currentUser)
      setStatus('authenticated')
      setError('')
      return currentUser
    } catch (requestError) {
      setUser(null)
      if (requestError.status === 401) {
        setStatus('anonymous')
        setError('')
        return null
      }

      setStatus('unavailable')
      setError(requestError.message)
      return null
    }
  }, [])

  const request = useCallback(async (path, options) => {
    try {
      return await apiRequest(path, options)
    } catch (requestError) {
      if (requestError.status === 401) {
        setUser(null)
        setStatus('anonymous')
      }
      throw requestError
    }
  }, [])

  const login = useCallback(async (email, password) => {
    setBusy(true)
    setError('')
    try {
      await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      const currentUser = await loadCurrentUser()
      if (!currentUser) {
        throw new Error('Your session could not be verified. Please sign in again.')
      }
      return currentUser
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setBusy(false)
    }
  }, [loadCurrentUser])

  const logout = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setStatus('anonymous')
    } catch (requestError) {
      if (requestError.status === 401) {
        setUser(null)
        setStatus('anonymous')
        return
      }
      setError(requestError.message)
      throw requestError
    } finally {
      setBusy(false)
    }
  }, [])

  const registerCustomer = useCallback(async (data) => {
    setBusy(true)
    setError('')
    try {
      const response = await apiRequest('/api/auth/register-customer', {
        method: 'POST',
        body: data,
      })
      return response.user
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setBusy(false)
    }
  }, [])

  const clearError = useCallback(() => setError(''), [])

  useEffect(() => {
    let active = true
    fetchCurrentUser()
      .then((currentUser) => {
        if (!active) return
        setUser(currentUser)
        setStatus('authenticated')
      })
      .catch((requestError) => {
        if (!active) return
        setUser(null)
        if (requestError.status === 401) {
          setStatus('anonymous')
          return
        }
        setStatus('unavailable')
        setError(requestError.message)
      })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo(() => ({
    user,
    status,
    error,
    busy,
    request,
    login,
    logout,
    loadCurrentUser,
    registerCustomer,
    clearError,
  }), [user, status, error, busy, request, login, logout, loadCurrentUser, registerCustomer, clearError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
