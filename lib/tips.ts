// Spanish-first rotating tip bank. 30 tips — one per day, deterministic
// rotation based on day-of-year so every visitor on the same day sees
// the same tip (shareable, screenshotable, doesn't feel random/broken).
//
// Voice rules: local RGV, not corporate. "Ahorita", "pásenle", concrete
// numbers, neighborhood framing. No "optimize your crossing experience"
// marketing-speak. Each tip should feel like advice from a primo who
// crosses every week.

export interface CruzarTip {
  id: string
  es: string
  en: string
  // Optional deep link — if present, tip card becomes tappable
  href?: string
}

export const TIPS: CruzarTip[] = [
  {
    id: 'sentri_savings',
    es: 'SENTRI te ahorra 30–90 min en promedio. La cuota es única ($122.25) y dura 5 años.',
    en: 'SENTRI saves 30–90 min on average. One-time $122.25 fee, lasts 5 years.',
    href: '/insurance',
  },
  {
    id: 'mon_fri_slow',
    es: 'Los lunes y viernes son los días más lentos en todos los puentes. Si puedes, cruza martes o miércoles.',
    en: 'Mondays and Fridays are the slowest days on every bridge. Cross Tuesday or Wednesday if you can.',
  },
  {
    id: 'early_morning',
    es: 'Entre 4–6am casi nunca hay fila. Si vas temprano al dentista o a la farmacia, sal antes del amanecer.',
    en: 'There\'s almost no line between 4–6am. Leave before sunrise if you\'re heading to the dentist or pharmacy.',
  },
  {
    id: 'anzalduas_secret',
    es: 'Anzaldúas casi siempre tiene menos espera que Hidalgo. Pruébalo la próxima vez que cruces por McAllen.',
    en: 'Anzaldúas almost always has less wait than Hidalgo. Try it next time you cross through McAllen.',
  },
  {
    id: 'lanes_matter',
    es: 'No todas las filas son iguales: las sin rayos avanzan más rápido. Mira bien antes de escoger.',
    en: 'Not all lanes move the same — lanes without X-ray go faster. Look before you pick one.',
  },
  {
    id: 'docs_ready',
    es: 'Lleva tu licencia, pasaporte y placa visible antes de llegar al puente. Cada segundo cuenta en la caseta.',
    en: 'Have your ID, passport, and plate visible before you reach the bridge. Every second counts at the booth.',
  },
  {
    id: 'sunday_church',
    es: 'Los domingos en la tarde hay colas largas en todos los puentes — es la hora pico de regreso.',
    en: 'Sunday afternoons get long lines at every bridge — that\'s peak return hour.',
  },
  {
    id: 'holiday_surge',
    es: 'Los días antes de Día de Acción de Gracias y Navidad la espera sube al doble. Planea con anticipación.',
    en: 'Days before Thanksgiving and Christmas wait times double. Plan ahead.',
  },
  {
    id: 'alert_setup',
    es: 'Activa una alerta gratis y te avisamos cuando tu puente baje de 30 min — sin tener que estar revisando.',
    en: 'Set a free alert and we\'ll ping you when your bridge drops below 30 min — no need to keep checking.',
    href: '/dashboard?tab=alerts',
  },
  {
    id: 'report_helps',
    es: 'Un reporte tuyo ayuda a 20 personas que vienen atrás. Tarda 5 segundos — es la forma más fácil de echar la mano.',
    en: 'One report from you helps 20 people behind you. Takes 5 seconds — easiest way to lend a hand.',
  },
  {
    id: 'semana_santa',
    es: 'Semana Santa es la semana más pesada del año para cruzar. Si puedes, cruza el miércoles o jueves antes.',
    en: 'Holy Week is the heaviest crossing week of the year. Cross the Wednesday or Thursday before if you can.',
  },
  {
    id: 'exchange_rate',
    es: 'Las casas de cambio del lado mexicano casi siempre pagan mejor que las del lado americano. Revisa la cotización del día.',
    en: 'Exchange houses on the Mexican side almost always pay better than the U.S. side. Check today\'s rate.',
  },
  {
    id: 'progreso_route',
    es: 'Progreso es el puente más tranquilo del valle — buena opción si andas por la costa.',
    en: 'Progreso is the calmest bridge in the valley — good option if you\'re on the coast side.',
  },
  {
    id: 'share_location',
    es: 'Comparte cruzar.app con tu gente que cruza — a nadie le gusta esperar en fila sin saber cuánto falta.',
    en: 'Share cruzar.app with your people who cross — nobody likes waiting in line not knowing how long it\'ll take.',
  },
  {
    id: 'roma_falcon',
    es: 'Si vas al norte de Tamaulipas, Roma y Falcón tienen esperas muy cortas casi siempre.',
    en: 'If you\'re headed to northern Tamaulipas, Roma and Falcón almost always have very short waits.',
  },
  {
    id: 'pharr_truckers',
    es: 'Pharr es el puente más usado para camiones comerciales — si cruzas en carro, los otros pueden ser más rápidos.',
    en: 'Pharr is the busiest commercial truck bridge — if you\'re in a car, the others may be faster.',
  },
  {
    id: 'water_snacks',
    es: 'Lleva agua y algo de comer si vas en hora pico. Una fila de 2 horas con niños sin snack es drama.',
    en: 'Bring water and snacks if you\'re going in peak hours. A 2-hour line with kids and no snacks is drama.',
  },
  {
    id: 'weather_impact',
    es: 'Cuando hay neblina o lluvia fuerte, la espera puede doblarse. Revisa el clima antes de salir.',
    en: 'Fog or heavy rain can double wait times. Check the weather before you leave.',
  },
  {
    id: 'sentri_hours',
    es: 'Las filas SENTRI cierran más temprano que las normales en algunos puentes. Verifica antes de cruzar tarde.',
    en: 'SENTRI lanes close earlier than regular lanes at some bridges. Check before crossing late.',
  },
  {
    id: 'multiple_bridges',
    es: 'Guarda 2–3 puentes como favoritos, no solo uno. Así siempre tienes alternativa cuando uno está tapado.',
    en: 'Save 2–3 bridges as favorites, not just one. That way you always have a backup when one\'s jammed.',
    href: '/dashboard',
  },
  {
    id: 'school_days',
    es: 'Los primeros días de clases (agosto) las filas suben por los estudiantes que viven del otro lado.',
    en: 'First days of school (August) lines spike because of students who live across the border.',
  },
  {
    id: 'pay_toll_ahead',
    es: 'Ten cambio exacto para la caseta mexicana — ahorras 30 segundos que a veces son los que hacen la diferencia.',
    en: 'Have exact change for the Mexican toll — saves 30 seconds that sometimes make the difference.',
  },
  {
    id: 'community_beats_data',
    es: 'Los reportes de la comunidad son más exactos que los números oficiales — la gente ve lo que pasa en vivo.',
    en: 'Community reports are more accurate than official numbers — people see what\'s happening live.',
  },
  {
    id: 'midday_window',
    es: 'Entre 10am y 12pm suele haber una ventana tranquila entre las horas pico de la mañana y la comida.',
    en: 'There\'s usually a quiet window between 10am and noon — between the morning and lunch peaks.',
  },
  {
    id: 'install_app',
    es: 'Instala Cruzar en tu teléfono y se abre como app — sin navegador, sin buscar el enlace cada vez.',
    en: 'Install Cruzar on your phone and it opens like an app — no browser, no hunting for the link.',
  },
  {
    id: 'friday_night',
    es: 'Viernes por la tarde los puentes se llenan de gente que va de fiesta a Matamoros o Reynosa. Cruza antes de las 5pm.',
    en: 'Friday afternoon bridges fill up with people going out to Matamoros or Reynosa. Cross before 5pm.',
  },
  {
    id: 'laredo_options',
    es: 'Laredo tiene 4 puentes internacionales. Si uno está lento, casi siempre otro está más ligero.',
    en: 'Laredo has 4 international bridges. If one\'s slow, another is almost always lighter.',
  },
  {
    id: 'check_before_leave',
    es: 'Revisa cruzar.app antes de salir de casa, no cuando ya estás en la fila. Ahí ya es tarde.',
    en: 'Check cruzar.app before you leave home, not when you\'re already in line. By then it\'s too late.',
  },
  {
    id: 'report_rewards',
    es: 'Cada reporte que haces suma puntos. Los que más reportan salen en el leaderboard de guardianes.',
    en: 'Every report earns you points. Top reporters show up on the guardian leaderboard.',
    href: '/leaderboard',
  },
  {
    id: 'mexican_insurance',
    es: 'Si vas en carro americano a México, necesitas seguro mexicano aparte. Es barato y obligatorio.',
    en: 'Driving an American car into Mexico? You need separate Mexican insurance. It\'s cheap and required.',
    href: '/insurance',
  },
]

// Deterministic day-of-year rotation. Uses UTC so users in different
// timezones don't see a flicker when it rolls over. 30 tips divides
// 365 cleanly enough that each tip cycles about every month.
export function getTipOfDay(now: Date = new Date()): CruzarTip {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0)
  const diff = now.getTime() - start
  const dayOfYear = Math.floor(diff / 86_400_000)
  return TIPS[dayOfYear % TIPS.length]
}
