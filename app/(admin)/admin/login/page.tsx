'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, ArrowRight, Loader2 } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formatted = phone.replace(/\D/g, '')
    const fullPhone = formatted.startsWith('91') ? formatted : `91${formatted}`

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPhone(fullPhone)
      setStep('otp')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp, userType: 'admin' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/admin')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/alta-icon.png" alt="ALTA" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-primary)' }}>
            Experience Center
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Admin Login</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-8" style={{ borderColor: 'var(--color-border)' }}>
          {step === 'phone' ? (
            <form onSubmit={handleSendOtp}>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Phone Number
              </label>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>+91</span>
                <input
                  type="tel"
                  value={phone.replace(/^91/, '')}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit number"
                  className="flex-1 px-4 py-3 rounded-lg border text-base outline-none focus:border-[var(--color-ambient)]"
                  style={{ borderColor: 'var(--color-border)' }}
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading || phone.replace(/^91/, '').length !== 10}
                className="w-full py-3 rounded-lg text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><Phone size={18} /> Send OTP</>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                OTP sent to +{phone}
                <button type="button" className="ml-2 underline" style={{ color: 'var(--color-dark-ambient)' }}
                  onClick={() => { setStep('phone'); setOtp(''); setError('') }}>
                  Change
                </button>
              </p>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 rounded-lg border text-base text-center tracking-[0.5em] outline-none focus:border-[var(--color-ambient)] mb-4"
                style={{ borderColor: 'var(--color-border)' }}
                maxLength={6}
                autoFocus
              />
              {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-3 rounded-lg text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><ArrowRight size={18} /> Verify & Login</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
