const BASE = 'https://app.asana.com/api/1.0'

async function post(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ASANA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: body }),
  })
  if (!res.ok) throw new Error(`Asana ${path} → ${res.status}`)
  return res.json()
}

export async function postComment(taskId: string, text: string) {
  if (!taskId) return { success: false }
  try { await post(`/tasks/${taskId}/stories`, { text }); return { success: true } }
  catch (e: any) { return { success: false, error: e.message } }
}

export async function postEntered(taskId: string, start: string, end: string) {
  return postComment(taskId, `entered - ${start} to ${end}`)
}

export async function postClosed(taskId: string, reason: string, start: string, end: string) {
  return postComment(taskId, `closed - ${start} to ${end}${reason ? ` — ${reason}` : ''}`)
}
