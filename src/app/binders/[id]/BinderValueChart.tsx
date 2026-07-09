'use client'

import ValueChart from '@/components/ValueChart'

export default function BinderValueChart({ binderId }: { binderId: string }) {
  return <ValueChart endpoint={`/api/snapshots/binder/${binderId}`} />
}
