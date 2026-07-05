'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type RLang = 'en' | 'es'

// Full recruiting dashboard dictionary. Add keys here; pages call t('key').
export const DICT: Record<string, { en: string; es: string }> = {
  // tabs
  tab_queue: { en: 'New Queue', es: 'Cola nueva' },
  tab_interview: { en: 'Interview', es: 'Entrevista' },
  tab_pool: { en: 'Candidate Pool', es: 'Grupo de candidatos' },
  tab_rejected: { en: 'Rejected', es: 'Rechazados' },

  // shared actions / chrome
  import: { en: 'Import', es: 'Importar' },
  add_candidate: { en: 'Add candidate', es: 'Agregar candidato' },
  share_link: { en: 'Share application link', es: 'Compartir enlace de solicitud' },
  filters: { en: 'Filters', es: 'Filtros' },
  clear_filters: { en: 'Clear all filters', es: 'Borrar filtros' },
  search_ph: { en: 'Search name, email, position…', es: 'Buscar nombre, correo, puesto…' },
  loading: { en: 'Loading…', es: 'Cargando…' },
  save: { en: 'Save', es: 'Guardar' },
  saved: { en: 'Saved', es: 'Guardado' },
  done: { en: 'Done', es: 'Listo' },
  edit: { en: 'Edit', es: 'Editar' },
  none: { en: 'None', es: 'Ninguno' },
  error: { en: 'Error', es: 'Error' },

  // New Queue
  queue_sub: { en: 'Applications waiting for first review', es: 'Solicitudes esperando la primera revisión' },
  live: { en: 'Live', es: 'En vivo' },
  new_apps: { en: 'new applications', es: 'solicitudes nuevas' },
  new_app: { en: 'new application', es: 'solicitud nueva' },
  no_new_apps: { en: 'No new applications right now.', es: 'No hay solicitudes nuevas por ahora.' },
  initial_review: { en: 'Initial review', es: 'Revisión inicial' },
  profile_tier: { en: 'Profile tier', es: 'Nivel del perfil' },
  pass_to_pool: { en: 'Pass to pool', es: 'Pasar al grupo' },
  reject: { en: 'Reject', es: 'Rechazar' },
  reject_reason_ph: { en: 'Reason for rejection (optional)', es: 'Motivo del rechazo (opcional)' },
  view_only: { en: 'View only', es: 'Solo lectura' },
  view_only_msg: { en: 'You have read-only access to applications.', es: 'Tienes acceso de solo lectura a las solicitudes.' },
  set_tier_first: { en: 'Set a profile tier first', es: 'Primero asigna un nivel de perfil' },
  passed_pool: { en: 'Passed to Candidate Pool', es: 'Enviado al grupo de candidatos' },
  moved_rejected: { en: 'Moved to Rejected', es: 'Movido a Rechazados' },
  moved_interview: { en: 'Moved to Interview', es: 'Movido a Entrevista' },
  send_interview: { en: 'Interview', es: 'Entrevista' },

  // filter labels
  f_position: { en: 'Position', es: 'Puesto' },
  f_any_position: { en: 'All positions', es: 'Todos los puestos' },
  f_lives: { en: 'Lives in', es: 'Vive en' },
  f_any_borough: { en: 'Any borough', es: 'Cualquier condado' },
  f_transport: { en: 'Transportation', es: 'Transporte' },
  f_any_transport: { en: 'Any transport', es: 'Cualquier transporte' },
  f_language: { en: 'Language', es: 'Idioma' },
  f_any_language: { en: 'Any language', es: 'Cualquier idioma' },
  f_english: { en: 'English', es: 'Inglés' },
  f_spanish: { en: 'Español', es: 'Español' },
  f_source: { en: 'Source', es: 'Origen' },
  f_any_source: { en: 'Any source', es: 'Cualquier origen' },
  f_date: { en: 'Date added', es: 'Fecha agregada' },
  f_any_time: { en: 'Any time', es: 'Cualquier fecha' },
  f_today: { en: 'Today', es: 'Hoy' },
  f_7d: { en: 'Last 7 days', es: 'Últimos 7 días' },
  f_30d: { en: 'Last 30 days', es: 'Últimos 30 días' },
  f_from: { en: 'From date', es: 'Desde' },
  f_to: { en: 'To date', es: 'Hasta' },

  // drawer sections / fields
  s_applied_for: { en: 'Applied for', es: 'Aplicó para' },
  s_contact: { en: 'Contact', es: 'Contacto' },
  s_job_fit: { en: 'Job fit', es: 'Perfil laboral' },
  s_location: { en: 'Location', es: 'Ubicación' },
  s_experience: { en: 'Experience', es: 'Experiencia' },
  s_source_files: { en: 'Source & files', es: 'Origen y archivos' },
  s_internal: { en: 'Internal details', es: 'Detalles internos' },
  l_phone: { en: 'Phone', es: 'Teléfono' },
  l_email: { en: 'Email', es: 'Correo' },
  l_expected_pay: { en: 'Expected pay', es: 'Pago esperado' },
  l_availability: { en: 'Availability', es: 'Disponibilidad' },
  l_transportation: { en: 'Transportation', es: 'Transporte' },
  l_english: { en: 'English level', es: 'Nivel de inglés' },
  l_lives_in: { en: 'Lives in', es: 'Vive en' },
  l_open_to: { en: 'Open to work in', es: 'Dispuesto a trabajar en' },
  l_heard_via: { en: 'Heard via', es: 'Se enteró por' },
  view_resume: { en: 'View résumé', es: 'Ver currículum' },
  no_resume: { en: 'No résumé uploaded', es: 'Sin currículum' },
  sec_license: { en: 'Security license', es: 'Licencia de seguridad' },
  licensed: { en: 'Licensed', es: 'Con licencia' },
  unlicensed: { en: 'Unlicensed', es: 'Sin licencia' },
  view_license: { en: 'View license', es: 'Ver licencia' },

  // Pool
  pool_sub: { en: 'Interviewed · rated · ready to place', es: 'Entrevistados · calificados · listos' },
  missing_info: { en: 'Missing info', es: 'Falta información' },
  missing: { en: 'missing', es: 'falta' },
  list: { en: 'List', es: 'Lista' },
  photos: { en: 'Photos', es: 'Fotos' },
  sort_recent: { en: 'Sort: Recently added', es: 'Orden: Más recientes' },
  sort_longest: { en: 'Sort: Longest in funnel', es: 'Orden: Más tiempo' },
  no_longer_interested: { en: 'No longer interested', es: 'Ya no interesado' },
  tier: { en: 'Tier', es: 'Nivel' },
  stage: { en: 'Stage', es: 'Etapa' },
  move_to_pool: { en: 'Move to Pool', es: 'Mover al grupo' },

  // Interview
  interview_sub: { en: 'Scheduled by day · assign an interviewer', es: 'Agendado por día · asigna entrevistador' },
  g_today: { en: 'Today', es: 'Hoy' },
  g_tomorrow: { en: 'Tomorrow', es: 'Mañana' },
  g_week: { en: 'This week', es: 'Esta semana' },
  g_later: { en: 'Later', es: 'Más adelante' },
  g_unscheduled: { en: 'Needs scheduling', es: 'Falta agendar' },
  g_past: { en: 'Past', es: 'Pasadas' },
  schedule_interview: { en: 'Schedule interview', es: 'Agendar entrevista' },
  save_notify: { en: 'Save & notify', es: 'Guardar y notificar' },
  interviewer: { en: 'Interviewer', es: 'Entrevistador' },
  unassigned: { en: '— Unassigned —', es: '— Sin asignar —' },
  no_interviewer: { en: 'No interviewer assigned', es: 'Sin entrevistador asignado' },
  not_scheduled: { en: 'Not scheduled', es: 'No agendada' },
  no_interviews: { en: 'No candidates in interview stage. Send someone here from the New Queue.', es: 'No hay candidatos en entrevista. Envía a alguien desde la cola.' },

  // Rejected
  rejected_sub: { en: 'Not advanced · kept for reference', es: 'No avanzaron · guardados para referencia' },
  reason: { en: 'Reason', es: 'Motivo' },
  rejected_on: { en: 'Rejected', es: 'Rechazado' },
  restore_pool: { en: 'Restore to Pool', es: 'Restaurar al grupo' },
  restore_queue: { en: 'Restore to Queue', es: 'Restaurar a la cola' },
  no_rejected: { en: 'No rejected candidates.', es: 'No hay candidatos rechazados.' },
  candidate: { en: 'Candidate', es: 'Candidato' },

  // internal detail labels
  l_gender: { en: 'Gender', es: 'Género' },
  l_age: { en: 'Age', es: 'Edad' },
  l_nationality: { en: 'Nationality', es: 'Nacionalidad' },
  l_ethnicity: { en: 'Ethnicity', es: 'Etnia' },
  l_time_usa: { en: 'Time in USA', es: 'Tiempo en EE.UU.' },
  l_taxid: { en: 'Tax ID', es: 'ID fiscal' },
  l_ss: { en: 'SS', es: 'Seguro social' },
  l_bank: { en: 'Bank Acct', es: 'Cuenta banc.' },
  l_photo_video: { en: 'Photo & video', es: 'Foto y video' },
  l_resume_source: { en: 'Résumé & source', es: 'Currículum y origen' },
  l_strengths: { en: 'Strengths', es: 'Fortalezas' },
  ph_nationality: { en: 'Nationality…', es: 'Nacionalidad…' },
  ph_ethnicity: { en: 'Ethnicity…', es: 'Etnia…' },

  // pool table headers
  th_candidate: { en: 'Candidate', es: 'Candidato' },
  th_position: { en: 'Position', es: 'Puesto' },
  th_age_sex: { en: 'Age / Sex', es: 'Edad / Sexo' },
  th_tier: { en: 'Tier', es: 'Nivel' },
  th_stage: { en: 'Stage', es: 'Etapa' },
  th_added: { en: 'Added', es: 'Agregado' },
  th_in_funnel: { en: 'In funnel', es: 'En proceso' },
  missing_label: { en: 'Missing', es: 'Falta' },
  add_photo: { en: 'Add photo', es: 'Agregar foto' },
  replace_photo: { en: 'Replace photo', es: 'Reemplazar foto' },
  add_video: { en: 'Add video', es: 'Agregar video' },
  replace_video: { en: 'Replace video', es: 'Reemplazar video' },
  no_photo: { en: 'No photo', es: 'Sin foto' },
  no_video: { en: 'No video', es: 'Sin video' },
  upload_resume: { en: 'Upload résumé', es: 'Subir currículum' },
  replace: { en: 'Replace', es: 'Reemplazar' },
  view_in_asana: { en: 'View original in Asana', es: 'Ver original en Asana' },
  years: { en: 'Years', es: 'Años' },
  months: { en: 'Months', es: 'Meses' },
  tax_yes: { en: 'Yes', es: 'Sí' },
  tax_no: { en: 'No', es: 'No' },
  f_resume: { en: 'Résumé', es: 'Currículum' },
  f_video: { en: 'Video', es: 'Video' },
  f_profile: { en: 'Profile', es: 'Perfil' },
  f_gender: { en: 'Gender', es: 'Género' },
  f_age: { en: 'Age', es: 'Edad' },
  f_open: { en: 'Open to work', es: 'Dispuesto a trabajar' },
}

type Ctx = { lang: RLang; setLang: (l: RLang) => void; t: (k: string) => string }
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k) => DICT[k]?.en ?? k })

export function RecruitingLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<RLang>('en')
  useEffect(() => {
    try { const s = localStorage.getItem('rec_lang'); if (s === 'en' || s === 'es') setLangState(s) } catch {}
  }, [])
  const setLang = (l: RLang) => { setLangState(l); try { localStorage.setItem('rec_lang', l) } catch {} }
  const t = (k: string) => DICT[k]?.[lang] ?? DICT[k]?.en ?? k
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>
}

export const useRecruitingLang = () => useContext(LangCtx)
