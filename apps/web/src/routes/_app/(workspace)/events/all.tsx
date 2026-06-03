import { createFileRoute } from '@tanstack/react-router'

import { EventsAllPageContent } from '../../../../features/events/event-center'

export const Route = createFileRoute('/_app/(workspace)/events/all')({
  component: EventsAllPage,
})

function EventsAllPage() {
  return <EventsAllPageContent />
}
