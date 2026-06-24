const BASE = 'https://app.asana.com/api/1.0'
// Billing user GID — billing@bsmfacilitysolutions.com
// To find: go to app.asana.com, open any task assigned to billing@, 
// click their avatar, copy the GID from the URL
const BILLING_USER_GID = process.env.ASANA_BILLING_USER_GID || ''

async function asanaRequest(path: string, method: string, body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.ASANA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify({ data: body }) : undefined,
  })
  if (!res.ok) throw new Error(`Asana ${method} ${path} → ${res.status}`)
  return res.json()
}

export async function postEntered(
  taskId: string,
  start: string,
  end: string,
  entryType: 'cover' | 'extra_hours' | 'billable' = 'cover'
) {
  if (!taskId) return { success: false }
  try {
    // Post "entered" comment on all entry types
    await asanaRequest(`/tasks/${taskId}/stories`, 'POST', {
      text: `entered - ${start} to ${end}`
    })

    if (entryType === 'cover') {
      // Cover: mark task complete
      await asanaRequest(`/tasks/${taskId}`, 'PUT', { completed: true })
    } else {
      // Extra Hours + Billable: assign to billing, do NOT complete
      if (BILLING_USER_GID) {
        await asanaRequest(`/tasks/${taskId}`, 'PUT', {
          assignee: BILLING_USER_GID
        })
      }
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function postClosed(taskId: string, reason: string, start: string, end: string) {
  if (!taskId) return { success: false }
  try {
    await asanaRequest(`/tasks/${taskId}/stories`, 'POST', {
      text: `closed - ${start} to ${end}${reason ? ` — ${reason}` : ''}`
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
