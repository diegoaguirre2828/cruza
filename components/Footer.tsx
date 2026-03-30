import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-1">
          <span>🌉</span>
          <span className="font-medium text-gray-600 dark:text-gray-300">Cruza</span>
          <span className="ml-1">— Live US-Mexico border wait times</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Link href="/terms" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Privacy</Link>
          <Link href="/advertise" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Advertise</Link>
          <Link href="/pricing" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Pricing</Link>
          <a href="mailto:cruzabusiness@gmail.com" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Contact</a>
        </div>
        <p>© {new Date().getFullYear()} Cruza. Not affiliated with CBP.</p>
      </div>
    </footer>
  )
}
