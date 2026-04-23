import { Calendar, Clock, Construction } from 'lucide-react'

export default function TimetablePage() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'var(--color-active-bg)' }}>
        <Construction size={32} style={{ color: 'var(--color-dark-ambient)' }} />
      </div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>
        Timetable — Coming Soon
      </h2>
      <p className="text-sm max-w-md text-center" style={{ color: 'var(--color-text-secondary)' }}>
        Schedule management for campus × batch × section. Faculty allocation, room booking,
        and conflict prevention — all powered by the alta-scheduler data model.
      </p>
      <div className="flex gap-6 mt-8">
        {[
          { icon: Calendar, label: 'Semester scheduling' },
          { icon: Clock, label: 'Time slot management' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <item.icon size={16} style={{ color: 'var(--color-ambient)' }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}
