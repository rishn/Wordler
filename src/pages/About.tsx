import AppHeader from '../components/AppHeader'
import AnimatedGridBackground from '../components/AnimatedGridBackground'
import { Github, Linkedin } from 'lucide-react'

/* Component that renders the About Us page with information about the platform and its creators. */
export default function About() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 flex flex-col">
      <AppHeader />
      <div className="pt-[60px]" /> {/* Spacer for fixed header */}
         
      {/* Animated grid background - fixed position, starts below header */}
      <div className="fixed top-[60px] left-0 right-0 bottom-[60px] overflow-hidden z-5">
        <AnimatedGridBackground
          palette={['#6AAA64','#6AAA64','#C9B458','#C9B458','#6366F1','#EC4899','#787C7E','#878A8C']}
          rows={30}
          cols={60}
          opacity={0.40}
          jitter={0.22}
          intervalMs={1900}
          rounded
          blur
        />
      </div>
      <div className="fixed top-[60px] left-0 right-0 bottom-[60px] bg-white/60 dark:bg-zinc-900/20 backdrop-blur-05 z-7" />

      <main className="max-w-5xl mx-auto px-8 py-12 flex-1 w-full relative z-10">
        <h1 className="text-3xl font-semibold text-gray-600 dark:text-gray-300 mb-4">About Us</h1>
        <div className="prose dark:prose-invert text-gray-800 dark:text-gray-200">
          <p className="text-lg">Welcome to Wordler — an interactive platform to explore and strengthen your vocabulary.</p>
          <br/>
          <p>We help users expand word knowledge, sharpen pattern recognition, and build faster, more confident word-guessing skills through game-based practice and targeted feedback.</p>
          <br/>
          <p>This project was created by Educify™ An EduTech Enterprise, 2025. This platform was built with love and care by a group of passionate individuals who wish to contribute to the community.</p>
          <br/>
          <p>We're continuously adding curated word lists, example usages, and new game modes to help you learn effectively. Thank you for your patience as we grow the platform.</p>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <a href="https://github.com/rishn" target="_blank" rel="noreferrer" title="GitHub" className="p-2 rounded-full bg-white/80 dark:bg-zinc-800/70 shadow hover:scale-105 transition">
            <Github className="h-6 w-6 text-gray-800 dark:text-gray-200" />
          </a>
          <a href="https://www.linkedin.com/in/rishaanjacob/" target="_blank" rel="noreferrer" title="LinkedIn" className="p-2 rounded-full bg-white/80 dark:bg-zinc-800/70 shadow hover:scale-105 transition">
            <Linkedin className="h-6 w-6 text-blue-700 dark:text-blue-400" />
          </a>
        </div>
      </main>

      {/* Footer with fixed position at the bottom */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 py-6 text-center text-xs text-gray-600 dark:text-gray-400 bg-[#f5f5f5] dark:bg-[#18181b]">Wordler by Educify™ An EduTech Enterprise 2025</footer>
      <div className="pb-[60px]" />
    </div>
  )
}