import { lazy, Suspense } from 'react'

const LazyStrrIntegration = lazy(async () => {
  const module = await import('./StrrIntegration')
  return { default: module.StrrIntegration }
})

export function StrrIntegrationRoute() {
  return (
    <Suspense fallback={null}>
      <LazyStrrIntegration />
    </Suspense>
  )
}
