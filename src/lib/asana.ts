const BASE = 'https://app.asana.com/api/1.0'

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

export async function postEntered(taskId: string, start: string, end: string) {
  if (!taskId) return { success: false }
  try {
    await asanaRequest(`/tasks/${taskId}/stories`, 'POST', {
      text: `entered - ${start} to ${end}`
    })
    await asanaRequest(`/tasks/${taskId}`, 'PUT', { completed: true })
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
