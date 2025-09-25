'use client'

import { useState } from 'react'

export default function TestAuthPage() {
  const [email, setEmail] = useState('newuser@example.com')
  const [password, setPassword] = useState('Test123!')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testLogin = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('http://localhost:3001/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
        // Store token for future requests
        if (data.data?.token) {
          localStorage.setItem('test-token', data.data.token)
        }
      } else {
        setError(JSON.stringify(data, null, 2))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const testProtectedRoute = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    const token = localStorage.getItem('test-token')
    if (!token) {
      setError('No token found. Please login first.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('http://localhost:3001/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(JSON.stringify(data, null, 2))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Authentication Test Page</h1>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Test Login</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <button
              onClick={testLogin}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Login'}
            </button>

            <button
              onClick={testProtectedRoute}
              disabled={loading}
              className="ml-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Protected Route (/me)'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 p-6 rounded-lg">
            <h3 className="text-red-800 font-semibold mb-2">Error:</h3>
            <pre className="text-red-600 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {result && (
          <div className="bg-green-50 p-6 rounded-lg">
            <h3 className="text-green-800 font-semibold mb-2">Success:</h3>
            <pre className="text-green-600 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}