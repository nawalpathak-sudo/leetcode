import { GraduationCap } from 'lucide-react'

export default function Faculties() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-ambient/10 flex items-center justify-center mb-4">
        <GraduationCap size={32} className="text-ambient" />
      </div>
      <h2 className="text-lg font-semibold text-primary">Faculties</h2>
      <p className="text-sm text-primary/40 mt-1">Faculty management coming soon</p>
    </div>
  )
}
