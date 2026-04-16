// Target Facebook groups for automated posting.
// Each entry is a full group URL that the Natividad Rivera alt account
// is already a member of. ONLY public groups are listed — private
// groups that require admin approval on every post are explicitly
// excluded because admin-queue submissions are a detection signal.
//
// The list is maintained manually by Diego. To add a group:
//   1. Join the group via the Natividad alt account in a real browser
//   2. Add the group URL here
//   3. Redeploy to Railway
//
// Posting cadence is controlled by the schedule in index.ts, not here.
// Default: 2 posts/day at pre-peak windows (see project memory
// project_cruzar_fb_peak_hours.md).

export interface TargetGroup {
  url: string
  name: string
  region: string
}

export const TARGET_GROUPS: TargetGroup[] = [
  /* ---- RGV / Reynosa / McAllen area ---- */
  {
    url: 'https://www.facebook.com/groups/302019986939323/',
    name: 'FILAS DE PUENTES REYNOSA HIDALGO DONNA',
    region: 'rgv',
  },
  {
    url: 'https://www.facebook.com/groups/2331786033753528/',
    name: 'FILAS DE PUENTES ANZALDUAS HIDALGO PHARR',
    region: 'rgv',
  },
  {
    url: 'https://www.facebook.com/groups/630300451147099/',
    name: 'Fila en Puentes Reynosa Hidalgo Anzalduas y Pharr',
    region: 'rgv',
  },

  /* ---- Brownsville / Matamoros ---- */
  {
    url: 'https://www.facebook.com/groups/133994363868664/',
    name: 'Brownsville Border Crossing Times / Filas de Puentes',
    region: 'brownsville',
  },

  /* ---- Laredo / Nuevo Laredo ---- */
  {
    url: 'https://www.facebook.com/groups/276336942705237/',
    name: 'Reporte de filas de puentes internacionales Nuevo Laredo',
    region: 'laredo',
  },
  {
    url: 'https://www.facebook.com/groups/2222671381117121/',
    name: 'Puentes internacionales de Nuevo Laredo El Reporte',
    region: 'laredo',
  },

  /* ---- Eagle Pass / Piedras Negras ---- */
  {
    url: 'https://www.facebook.com/groups/1099015074497879/',
    name: 'Puentes 1 y 2 de Eagle Pass y Piedras Negras',
    region: 'eagle-pass',
  },
  {
    url: 'https://www.facebook.com/groups/994149160726349/',
    name: 'Filas de los puentes 1 y 2 (Piedras Negras - Eagle Pass)',
    region: 'eagle-pass',
  },

  /* ---- San Ysidro / Tijuana ---- */
  {
    url: 'https://www.facebook.com/groups/1672359836893334/',
    name: 'Como esta la linea Tijuana/San Ysidro',
    region: 'san-ysidro',
  },
  {
    url: 'https://www.facebook.com/groups/393120005040423/',
    name: 'Como Esta La Linea Oficial San Ysidro-Otay-Tijuana',
    region: 'san-ysidro',
  },
]
